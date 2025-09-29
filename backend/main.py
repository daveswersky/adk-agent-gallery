import asyncio
import json
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

async def read_stream(stream, agent_name):
    """Reads from a stream and broadcasts lines as log messages."""
    while True:
        line = await stream.readline()
        if not line:
            break
        await manager.broadcast(json.dumps({"type": "log", "agent": agent_name, "line": line.decode().strip()}))


async def start_agent_process(agent_name: str, port: int):
    """Starts an ADK agent on a specific port."""
    if agent_name in running_processes:
        await manager.broadcast(json.dumps({"type": "status", "agent": agent_name, "status": "already_running"}))
        return

    # In a real app, you'd have a config to find the agent's path
    agent_path = f"agents/{agent_name}" 

    command = [
        "adk", "api_server",
        "--port", str(port),
        "--allow_origins", "*"
    ]
    
    process = await asyncio.create_subprocess_exec(
        *command,
        cwd=agent_path,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    running_processes[agent_name] = process
    
    agent_url = f"http://localhost:{port}"
    await manager.broadcast(json.dumps({
        "type": "status", 
        "agent": agent_name, 
        "status": "running", 
        "pid": process.pid,
        "url": agent_url
    }))

    asyncio.create_task(read_stream(process.stdout, agent_name))
    asyncio.create_task(read_stream(process.stderr, agent_name))
    
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
