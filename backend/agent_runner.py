import asyncio
import json
import os
import re
from typing import Optional, Any, List
import httpx
import yaml
from backend.connection_manager import manager
import multiprocessing as mp
import uuid

class EventStreamProtocol(asyncio.Protocol):
    """An asyncio protocol that reads newline-delimited JSON events from a pipe and broadcasts them."""
    def __init__(self, agent_name: str):
        self.agent_name = agent_name
        self.transport: Optional[asyncio.Transport] = None

    def connection_made(self, transport: asyncio.Transport):
        self.transport = transport

    def data_received(self, data: bytes):
        lines = data.decode().splitlines()
        for line in lines:
            if line:
                try:
                    event_data = json.loads(line)
                    # Broadcast the event over the WebSocket manager immediately
                    asyncio.create_task(manager.broadcast(json.dumps({
                        "type": "agent_event",
                        "agent": self.agent_name,
                        "data": event_data
                    })))
                except json.JSONDecodeError:
                    print(f"AGENT_EVENT_STREAM({self.agent_name}): Received non-JSON data: {line}", flush=True)

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
        self.event_protocol: Optional[EventStreamProtocol] = None

    async def start(self):
        """Creates a venv, installs dependencies, and starts the agent subprocess."""
        venv_path = os.path.join(self.agent_path, ".venv")
        python_executable = os.path.join(venv_path, "bin", "python")
        uv_executable = os.path.join(venv_path, "bin", "uv")
        requirements_path = os.path.join(self.agent_path, "requirements.txt")
        host_requirements_path = os.path.abspath("backend/agent_host_requirements.txt")
        config_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'agents.config.yaml'))

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

        # 2. Prepare agent-specific environment from config file
        env = os.environ.copy()
        if os.path.exists(config_path):
            try:
                with open(config_path, 'r') as f:
                    config = yaml.safe_load(f) or {}
            except yaml.YAMLError as e:
                await manager.broadcast(json.dumps({
                    "type": "log",
                    "agent": self.agent_name,
                    "line": f"[ERROR] Failed to parse agents.config.yaml: {e}. Continuing without agent-specific config."
                }))
                config = {}
            
            agent_config = config.get("agents", {}).get(self.agent_name, {})
            if agent_config:
                await manager.broadcast(json.dumps({
                    "type": "log", 
                    "agent": self.agent_name, 
                    "line": f"Applying agent-specific configuration for {self.agent_name}."
                }))
                
                env_updates = agent_config.get("environment", {})
                for key, value in env_updates.items():
                    if key == "UNSET_ENV_VARS":
                        for var_to_unset in value:
                            env.pop(var_to_unset, None)
                    else:
                        env[str(key)] = os.path.expandvars(str(value))

        # 3. Install dependencies (agent and host)
        await manager.broadcast(json.dumps({"type": "status", "agent": self.agent_name, "status": "installing_dependencies"}))
        env["VIRTUAL_ENV"] = venv_path
        
        # Install agent requirements
        if os.path.exists(requirements_path):
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
                raise RuntimeError("Failed to install agent dependencies.")

        # Install host requirements
        proc = await asyncio.create_subprocess_exec(
            uv_executable, "pip", "install", "-r", host_requirements_path,
            cwd=self.agent_path,
            env=env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        asyncio.create_task(_read_pip_stream(proc.stdout, self.agent_name, False))
        asyncio.create_task(_read_pip_stream(proc.stderr, self.agent_name, True))
        await proc.wait()
        if proc.returncode != 0:
            raise RuntimeError("Failed to install host dependencies.")


        # 4. Start the agent
        agent_host_script = os.path.abspath("backend/agent_host.py")
        
        # We no longer need to manipulate the env dictionary directly,
        # as the .env file will be handled by the agent_host.py script.
        
        # Explicitly pass Application Default Credentials if they exist.
        # This is crucial for subprocesses to authenticate with Vertex AI.
        adc_path = os.path.expanduser("~/.config/gcloud/application_default_credentials.json")
        if os.path.exists(adc_path):
            env["GOOGLE_APPLICATION_CREDENTIALS"] = adc_path
        
        # Create the pipe for event streaming
        read_fd, write_fd = os.pipe()

        command = [
            python_executable, 
            "-u",
            agent_host_script, 
            "--agent-path", self.agent_path, 
            "--port", str(self.port),
            "--event-pipe-fd", str(write_fd),
            "--verbose"
        ]

        self.process = await asyncio.create_subprocess_exec(
            *command,
            cwd=self.agent_path,
            env=env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            pass_fds=[write_fd] # Pass the write-end of the pipe to the child
        )

        # The parent process no longer needs the write-end
        os.close(write_fd)

        # Connect the read-end of the pipe to an asyncio protocol
        loop = asyncio.get_running_loop()
        read_pipe = os.fdopen(read_fd, 'r')
        transport, self.event_protocol = await loop.connect_read_pipe(
            lambda: EventStreamProtocol(self.agent_name),
            read_pipe
        )

        started_event = asyncio.Event()
        asyncio.create_task(_read_stream_and_signal_start(self.process.stdout, self.agent_name, False, started_event))
        asyncio.create_task(_read_stream_and_signal_start(self.process.stderr, self.agent_name, True, started_event))
        
        await started_event.wait()

    async def run_turn(self, prompt: str) -> dict:
        """Sends a prompt to the agent and returns the response."""
        url = f"http://localhost:{self.port}/"
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, json={"prompt": prompt}, timeout=60)
                response.raise_for_status()
                
                agent_response = response.json().get("response", "")
                
                return {"response": agent_response}

            except httpx.RequestError as e:
                await manager.broadcast(json.dumps({"type": "log", "agent": self.agent_name, "line": f"[ERROR] Could not connect to agent: {e}"}))
                return {"response": "Error: Could not connect to the agent."}

    async def stop(self):
        """Stops the agent subprocess."""
        print("--- DEBUG: AgentRunner.stop() called.")
        if self.process and self.process.returncode is None:
            print(f"--- DEBUG: Terminating process with PID {self.process.pid}")
            self.process.terminate()
            await self.process.wait()
            print("--- DEBUG: Process termination awaited.")