import asyncio
import json
import os
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict

# In-memory store for running agent processes
running_processes: Dict[str, asyncio.subprocess.Process] = {}

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

async def read_stream_and_signal_start(stream, agent_name: str, is_error_stream: bool, started_event: asyncio.Event):
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

async def read_pip_stream(stream, agent_name: str, is_error_stream: bool):
    """Reads from a pip install stream and broadcasts lines as log messages."""
    while True:
        line = await stream.readline()
        if not line:
            break
        line_str = line.decode().strip()
        log_line = f"[PIP_ERROR] {line_str}" if is_error_stream else f"[PIP] {line_str}"
        await manager.broadcast(json.dumps({"type": "log", "agent": agent_name, "line": log_line}))

async def start_agent_process(agent_name: str, port: int):
    """Starts an ADK agent on a specific port."""
    if agent_name in running_processes:
        await manager.broadcast(json.dumps({"type": "status", "agent": agent_name, "status": "already_running"}))
        return

    agent_path = os.path.abspath(f"agents/{agent_name}")
    venv_path = os.path.join(agent_path, ".venv")
    python_executable = os.path.join(venv_path, "bin", "python")
    requirements_path = os.path.join(agent_path, "requirements.txt")

    # 1. Create virtual environment if it doesn't exist
    if not os.path.exists(venv_path):
        await manager.broadcast(json.dumps({"type": "status", "agent": agent_name, "status": "creating_venv"}))
        try:
            proc = await asyncio.create_subprocess_exec(
                "python3", "-m", "venv", venv_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            # Stream venv creation output
            asyncio.create_task(read_pip_stream(proc.stdout, agent_name, False))
            asyncio.create_task(read_pip_stream(proc.stderr, agent_name, True))
            await proc.wait()

            if proc.returncode != 0:
                error_msg = f"Failed to create venv for {agent_name}. Check logs for details."
                await manager.broadcast(json.dumps({"type": "log", "agent": agent_name, "line": f"[ERROR] {error_msg}"}))
                await manager.broadcast(json.dumps({"type": "status", "agent": agent_name, "status": "failed"}))
                return
            await manager.broadcast(json.dumps({"type": "log", "agent": agent_name, "line": f"Virtual environment created for {agent_name}"}))

            # Install uv in the new venv
            await manager.broadcast(json.dumps({"type": "log", "agent": agent_name, "line": f"Installing uv in {agent_name} venv"}))
            proc = await asyncio.create_subprocess_exec(
                python_executable, "-m", "pip", "install", "uv",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            asyncio.create_task(read_pip_stream(proc.stdout, agent_name, False))
            asyncio.create_task(read_pip_stream(proc.stderr, agent_name, True))
            await proc.wait()

            if proc.returncode != 0:
                error_msg = f"Failed to install uv in {agent_name} venv. Check logs for details."
                await manager.broadcast(json.dumps({"type": "log", "agent": agent_name, "line": f"[ERROR] {error_msg}"}))
                await manager.broadcast(json.dumps({"type": "status", "agent": agent_name, "status": "failed"}))
                return
        except Exception as e:
            error_msg = f"Exception creating venv for {agent_name}: {e}"
            await manager.broadcast(json.dumps({"type": "log", "agent": agent_name, "line": f"[ERROR] {error_msg}"}))
            await manager.broadcast(json.dumps({"type": "status", "agent": agent_name, "status": "failed"}))
            return

    # 2. Make sure uv is installed
    uv_executable = os.path.join(venv_path, "bin", "uv")
    if not os.path.exists(uv_executable):
        await manager.broadcast(json.dumps({"type": "log", "agent": agent_name, "line": f"uv not found, installing in {agent_name} venv"}))
        try:
            proc = await asyncio.create_subprocess_exec(
                python_executable, "-m", "pip", "install", "uv",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            asyncio.create_task(read_pip_stream(proc.stdout, agent_name, False))
            asyncio.create_task(read_pip_stream(proc.stderr, agent_name, True))
            await proc.wait()

            if proc.returncode != 0:
                error_msg = f"Failed to install uv in {agent_name} venv. Check logs for details."
                await manager.broadcast(json.dumps({"type": "log", "agent": agent_name, "line": f"[ERROR] {error_msg}"}))
                await manager.broadcast(json.dumps({"type": "status", "agent": agent_name, "status": "failed"}))
                return
        except Exception as e:
            error_msg = f"Exception installing uv for {agent_name}: {e}"
            await manager.broadcast(json.dumps({"type": "log", "agent": agent_name, "line": f"[ERROR] {error_msg}"}))
            await manager.broadcast(json.dumps({"type": "status", "agent": agent_name, "status": "failed"}))
            return

    # 3. Install dependencies if requirements.txt exists
    if os.path.exists(requirements_path):
        await manager.broadcast(json.dumps({"type": "status", "agent": agent_name, "status": "installing_dependencies"}))
        try:
            proc = await asyncio.create_subprocess_exec(
                uv_executable, "pip", "install", "-r", requirements_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            # Stream pip install output
            asyncio.create_task(read_pip_stream(proc.stdout, agent_name, False))
            asyncio.create_task(read_pip_stream(proc.stderr, agent_name, True))
            await proc.wait()

            if proc.returncode != 0:
                error_msg = f"Failed to install dependencies for {agent_name}. Check logs for details."
                await manager.broadcast(json.dumps({"type": "log", "agent": agent_name, "line": f"[ERROR] {error_msg}"}))
                await manager.broadcast(json.dumps({"type": "status", "agent": agent_name, "status": "failed"}))
                return
            await manager.broadcast(json.dumps({"type": "log", "agent": agent_name, "line": f"Dependencies installed for {agent_name}"}))
        except Exception as e:
            error_msg = f"Exception installing dependencies for {agent_name}: {e}"
            await manager.broadcast(json.dumps({"type": "log", "agent": agent_name, "line": f"[ERROR] {error_msg}"}))
            await manager.broadcast(json.dumps({"type": "status", "agent": agent_name, "status": "failed"}))
            return

    # 4. Execute agent using its virtual environment's python
    adk_executable = os.path.join(venv_path, "bin", "adk")
    command = [adk_executable, "api_server", "--port", str(port), "--allow_origins", "*"]

    process = await asyncio.create_subprocess_exec(
        *command,
        cwd=agent_path,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    running_processes[agent_name] = process

    started_event = asyncio.Event()

    # Read both stdout and stderr to find the startup message
    asyncio.create_task(read_stream_and_signal_start(process.stdout, agent_name, False, started_event))
    asyncio.create_task(read_stream_and_signal_start(process.stderr, agent_name, True, started_event))

    # Wait for the startup message before broadcasting the running status
    await started_event.wait()

    agent_url = f"http://localhost:{port}"
    await manager.broadcast(json.dumps({
        "type": "status",
        "agent": agent_name,
        "status": "running",
        "pid": process.pid,
        "url": agent_url
    }))

    await process.wait()
    del running_processes[agent_name]
    await manager.broadcast(json.dumps({"type": "status", "agent": agent_name, "status": "stopped", "url": None}))


async def stop_agent_process(agent_name: str):
    """Stops a running ADK agent process."""
    if agent_name in running_processes:
        process = running_processes[agent_name]
        process.terminate()
        await process.wait()
        return
    await manager.broadcast(json.dumps({"type": "status", "agent": agent_name, "status": "not_running"}))


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            command = json.loads(data)
            
            action = command.get("action")
            agent_name = command.get("agent_name")

            if action == "start":
                port = command.get("port")
                if port:
                    asyncio.create_task(start_agent_process(agent_name, port))
            elif action == "stop":
                asyncio.create_task(stop_agent_process(agent_name))

    except WebSocketDisconnect:
        manager.disconnect(websocket)
