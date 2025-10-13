import asyncio
import json
import os
import re
from typing import Optional, Any
import httpx
from backend.connection_manager import manager
import multiprocessing as mp
from multiprocessing.managers import BaseManager, SyncManager
import uuid

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

    def __init__(self, agent_name: str, agent_path: str, port: int, mp_manager: SyncManager):
        self.agent_name = agent_name
        self.agent_path = agent_path
        self.port = port
        self.process: Optional[asyncio.subprocess.Process] = None
        
        # IPC setup
        self.manager = mp_manager
        self.shared_dict = self.manager.dict()
        self.event_queue = self.manager.Queue()
        self.queue_id = f"queue_{uuid.uuid4()}"
        self.shared_dict[self.queue_id] = self.event_queue


    async def start(self):
        """Creates a venv, installs dependencies, and starts the agent subprocess."""
        venv_path = os.path.join(self.agent_path, ".venv")
        python_executable = os.path.join(venv_path, "bin", "python")
        uv_executable = os.path.join(venv_path, "bin", "uv")
        requirements_path = os.path.join(self.agent_path, "requirements.txt")
        host_requirements_path = os.path.abspath("backend/agent_host_requirements.txt")

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

        # 2. Install dependencies (agent and host)
        await manager.broadcast(json.dumps({"type": "status", "agent": self.agent_name, "status": "installing_dependencies"}))
        env = os.environ.copy()
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


        # 3. Start the agent
        agent_host_script = os.path.abspath("backend/agent_host.py")
        
        env["PYTHONPATH"] = os.path.abspath(".") # Add project root to python path
        
        manager_address = self.manager.address
        manager_authkey = self.manager._authkey.hex()

        command = [
            python_executable, 
            "-u",
            agent_host_script, 
            "--agent-path", self.agent_path, 
            "--port", str(self.port),
            "--event-queue-id", self.queue_id,
            "--manager-address", str(manager_address),
            "--manager-authkey", manager_authkey
        ]

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

    async def run_turn(self, prompt: str) -> dict:
        """Sends a prompt to the agent and returns the response and events."""
        url = f"http://localhost:{self.port}/"
        
        # Clear the queue before the turn
        while not self.event_queue.empty():
            self.event_queue.get()

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, json={"prompt": prompt}, timeout=60)
                response.raise_for_status()
                
                agent_response = response.json().get("response", "")
                
                events = []
                q = self.shared_dict[self.queue_id]
                while not q.empty():
                    event_str = q.get()
                    events.append(json.loads(event_str))

                return {"response": agent_response, "events": events}

            except httpx.RequestError as e:
                await manager.broadcast(json.dumps({"type": "log", "agent": self.agent_name, "line": f"[ERROR] Could not connect to agent: {e}"}))
                return {"response": "Error: Could not connect to the agent.", "events": []}

    async def stop(self):
        """Stops the agent subprocess."""
        if self.process and self.process.returncode is None:
            self.process.terminate()
            await self.process.wait()