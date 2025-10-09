import asyncio
import json
import os
import re
from typing import Optional
from backend.connection_manager import manager

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

        log_line = f"[ERROR] {line_str}" if is_error_stream else line_str
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
        log_line = f"[PIP_ERROR] {line_str}" if is_error_stream else f"[PIP] {line_str}"
        await manager.broadcast(json.dumps({"type": "log", "agent": agent_name, "line": log_line}))


class AgentRunner:
    """Manages the lifecycle of a single agent subprocess."""

    def __init__(self, agent_name: str, agent_path: str, port: int):
        self.agent_name = agent_name
        self.agent_path = agent_path
        self.port = port
        self.process: Optional[asyncio.subprocess.Process] = None

    async def start(self):
        """Creates a venv, installs dependencies, and starts the agent subprocess."""
        venv_path = os.path.join(self.agent_path, ".venv")
        python_executable = os.path.join(venv_path, "bin", "python")
        uv_executable = os.path.join(venv_path, "bin", "uv")
        requirements_path = os.path.join(self.agent_path, "requirements.txt")

        # 1. Create virtual environment if it doesn't exist
        if not os.path.exists(venv_path):
            await manager.broadcast(json.dumps({"type": "status", "agent": self.agent_name, "status": "creating_venv"}))
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
            asyncio.create_task(_read_pip_stream(proc.stdout, self.agent_name, False))
            asyncio.create_task(_read_pip_stream(proc.stderr, self.agent_name, True))
            await proc.wait()
            if proc.returncode != 0:
                raise RuntimeError("Failed to install uv.")

        # 2. Install dependencies
        if os.path.exists(requirements_path):
            await manager.broadcast(json.dumps({"type": "status", "agent": self.agent_name, "status": "installing_dependencies"}))
            env = os.environ.copy()
            env["VIRTUAL_ENV"] = venv_path
            proc = await asyncio.create_subprocess_exec(
                uv_executable, "pip", "install", "-r", requirements_path,
                cwd=self.agent_path,
                env=env,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            asyncio.create_task(_read_pip_stream(proc.stdout, self.agent_name, False))
            asyncio.create_task(_read_pip_stream(proc.stderr, self.agent_name, True))
            await proc.wait()
            if proc.returncode != 0:
                raise RuntimeError("Failed to install dependencies.")

        # 3. Start the agent
        adk_executable = os.path.join(venv_path, "bin", "adk")
        env = os.environ.copy()
        env["VIRTUAL_ENV"] = venv_path
        env["PYTHONPATH"] = self.agent_path
        
        module_name = self.agent_name.replace('-', '_')
        command = [adk_executable, "api_server", module_name, "--port", str(self.port), "--allow_origins", "*"]

        self.process = await asyncio.create_subprocess_exec(
            *command,
            cwd=self.agent_path,
            env=env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
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