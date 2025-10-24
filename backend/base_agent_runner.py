import asyncio
import json
import os
import re
from abc import ABC, abstractmethod
from typing import List, Optional

from backend.connection_manager import manager
from backend.config import AgentConfig


class EventStreamProtocol(asyncio.Protocol):
    """An asyncio protocol that reads newline-delimited JSON events from a pipe and broadcasts them."""
    def __init__(self, agent_id: str):
        self.agent_id = agent_id
        self.transport: Optional[asyncio.Transport] = None

    def connection_made(self, transport: asyncio.Transport):
        self.transport = transport

    def data_received(self, data: bytes):
        lines = data.decode().splitlines()
        for line in lines:
            if line:
                try:
                    # The data from the pipe is already a complete JSON message.
                    # We just need to add the agent_id and type before broadcasting.
                    event_payload = json.loads(line)
                    full_message = {
                        "type": "agent_event",
                        "agent": self.agent_id,
                        "data": event_payload
                    }
                    asyncio.create_task(manager.broadcast(json.dumps(full_message)))
                except json.JSONDecodeError:
                    print(f"AGENT_EVENT_STREAM({self.agent_id}): Received non-JSON data: {line}", flush=True)


async def _read_stream_and_signal_start(stream, agent_name: str, is_error_stream: bool, started_event: asyncio.Event):
    """
    Reads from a stream, broadcasts lines as logs, and sets an event
    once the agent's server has started.
    """
    while True:
        line = await stream.readline()
        if not line:
            break
        line_str = line.decode().strip()

        # Log subprocess output directly to the main process stdout for debugging tests
        stream_name = "stderr" if is_error_stream else "stdout"
        print(f"AGENT_HOST_SUBPROCESS({agent_name}, {stream_name}): {line_str}", flush=True)

        log_line = line_str
        if is_error_stream:
            is_info = (
                re.search(r"^\s*(INFO|DEBUG|WARNING)", line_str, re.IGNORECASE) or
                "Uvicorn running on" in line_str
            )
            if not is_info:
                log_line = f"[ERROR] {line_str}"

        await manager.broadcast(json.dumps({"type": "log", "agent": agent_name, "line": log_line}))

        if not started_event.is_set() and "Uvicorn running on" in line_str:
            started_event.set()

async def _read_pip_stream(stream, agent_name: str, is_error_stream: bool):
    """Reads from a pip install stream and broadcasts lines as log messages."""
    while True:
        line = await stream.readline()
        if not line:
            break
        line_str = line.decode().strip()

        log_line = f"[PIP] {line_str}"
        if is_error_stream:
            print(f"PIP_ERROR({agent_name}): {line_str}", flush=True)
            if not re.search(r"^\s*(audited|resolving|downloading|installing)", line_str, re.IGNORECASE):
                 log_line = f"[PIP_ERROR] {line_str}"
            else:
                 log_line = f"[PIP] {line_str}"

        await manager.broadcast(json.dumps({"type": "log", "agent": agent_name, "line": log_line}))


class BaseAgentRunner(ABC):
    """Abstract Base Class for managing the lifecycle of an agent subprocess."""

    def __init__(self, agent_path: str, agent_abs_path: str, port: int, config: AgentConfig):
        self.agent_path = agent_path
        self.agent_name = os.path.basename(agent_path)
        self.agent_abs_path = agent_abs_path
        self.port = port
        self.config = config
        self.process: Optional[asyncio.subprocess.Process] = None
        self.event_protocol: Optional[EventStreamProtocol] = None

    @abstractmethod
    def _get_dependency_install_command(self) -> List[str]:
        """Returns the command to install the agent's dependencies."""
        pass

    @abstractmethod
    def _get_agent_execution_command(self, event_pipe_fd: int) -> List[str]:
        """Returns the command to execute the agent."""
        pass

    def _get_agent_execution_cwd(self) -> str:
        """Returns the working directory for agent execution. Can be overridden."""
        return self.agent_abs_path

    async def start(self):
        """Creates a venv, installs dependencies, and starts the agent subprocess."""
        venv_path = os.path.join(self.agent_abs_path, ".venv")
        python_executable = os.path.join(venv_path, "bin", "python")
        uv_executable = os.path.join(venv_path, "bin", "uv")

        # 1. Create virtual environment if it doesn't exist
        if not os.path.exists(venv_path):
            await manager.broadcast(json.dumps({"type": "status", "agent": self.agent_path, "status": "creating_venv"}))
            proc = await asyncio.create_subprocess_exec(
                "python3", "-m", "venv", venv_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            asyncio.create_task(_read_pip_stream(proc.stdout, self.agent_name, False))
            asyncio.create_task(_read_pip_stream(proc.stderr, self.agent_name, True))
            await proc.wait()
            if proc.returncode != 0:
                raise RuntimeError("Failed to create venv.")

            # Install uv
            proc = await asyncio.create_subprocess_exec(
                python_executable, "-m", "pip", "install", "uv",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await proc.communicate()

            if not os.path.exists(uv_executable):
                stdout_str = stdout.decode().strip()
                stderr_str = stderr.decode().strip()
                raise RuntimeError(
                    f"Installation of 'uv' failed. The executable was not found at {uv_executable} after running pip. "
                    f"pip exit code: {proc.returncode}. "
                    f"stdout: {stdout_str}. "
                    f"stderr: {stderr_str}."
                )

        # 2. Install dependencies
        await manager.broadcast(json.dumps({"type": "status", "agent": self.agent_path, "status": "installing_dependencies"}))
        env = os.environ.copy()
        env["VIRTUAL_ENV"] = venv_path
        env["PORT"] = str(self.port)

        install_command = self._get_dependency_install_command()

        if install_command:
            proc = await asyncio.create_subprocess_exec(
                *install_command,
                cwd=self.agent_abs_path,
                env=env,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            asyncio.create_task(_read_pip_stream(proc.stdout, self.agent_name, False))
            asyncio.create_task(_read_pip_stream(proc.stderr, self.agent_name, True))
            await proc.wait()
            if proc.returncode != 0:
                raise RuntimeError(f"Failed to install dependencies.")

        # 3. Create the pipe for event streaming
        read_fd, write_fd = os.pipe()

        # 4. Start the agent
        execution_command = self._get_agent_execution_command(write_fd)
        execution_cwd = self._get_agent_execution_cwd()
        self.process = await asyncio.create_subprocess_exec(
            *execution_command,
            cwd=execution_cwd,
            env=env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            pass_fds=[write_fd]
        )

        # The parent process no longer needs the write-end
        os.close(write_fd)

        # Connect the read-end of the pipe to an asyncio protocol
        loop = asyncio.get_running_loop()
        read_pipe = os.fdopen(read_fd, 'r')
        transport, self.event_protocol = await loop.connect_read_pipe(
            lambda: EventStreamProtocol(self.agent_path),
            read_pipe
        )

        started_event = asyncio.Event()
        asyncio.create_task(_read_stream_and_signal_start(self.process.stdout, self.agent_name, False, started_event))
        asyncio.create_task(_read_stream_and_signal_start(self.process.stderr, self.agent_name, True, started_event))
        
        await started_event.wait()

    async def stop(self):
        """Stops the agent subprocess."""
        if self.process and self.process.returncode is None:
            self.process.terminate()
            await self.process.wait()