from typing import List, Dict
from fastapi import WebSocket
import asyncio

# In-memory store for running agent processes
running_processes: Dict[str, Dict] = {}
starting_agents: set = set()
startup_lock = asyncio.Lock()

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