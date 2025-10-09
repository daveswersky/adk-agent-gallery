import asyncio
import json
import os
import re
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict
from backend.connection_manager import manager, running_processes, starting_agents, startup_lock
from backend.agent_runner import AgentRunner

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

@app.on_event("shutdown")
async def shutdown_event():
    """Gracefully terminate all running agent subprocesses on server shutdown."""
    print("Server shutting down. Terminating agent processes...")
    for agent_name, runner in list(running_processes.items()):
        print(f"Stopping agent: {agent_name}")
        await runner.stop()
    running_processes.clear()
    print("All agent processes terminated.")

@app.get("/agents")
async def get_agents():
    """Scans agent directories and returns a list of available agents."""
    agents = []
    agent_dirs = [
        os.path.abspath("agents"),
        os.path.abspath("agents/adk-samples/python/agents")
    ]

    for agents_dir in agent_dirs:
        if not os.path.exists(agents_dir):
            continue
        for agent_id in os.listdir(agents_dir):
            if agent_id == 'adk-samples':
                continue
            agent_path = os.path.join(agents_dir, agent_id)
            if os.path.isdir(agent_path):
                description = f"The {agent_id} agent."  # Default description
                
                module_name = agent_id.replace('-', '_')
                nested_agent_path = os.path.join(agent_path, module_name)
                if not os.path.exists(nested_agent_path):
                    nested_agent_path = os.path.join(agent_path, agent_id)

                agent_py_path = os.path.join(nested_agent_path, "agent.py")

                if os.path.exists(agent_py_path):
                    try:
                        with open(agent_py_path, "r") as f:
                            content = f.read()
                            match = re.search(r'description=\(?\s*["\']([^"\']+)["\']', content, re.DOTALL)
                            if match:
                                description = match.group(1)
                    except Exception as e:
                        print(f"Could not read or parse {agent_py_path}: {e}")

                agents.append({
                    "id": agent_id,
                    "name": agent_id,
                    "description": description,
                })
    return agents

async def start_agent_process(agent_name: str, port: int):
    """Starts an ADK agent on a specific port."""
    await manager.broadcast(json.dumps({"type": "log", "agent": agent_name, "line": "Agent startup process started."}))
    async with startup_lock:
        if agent_name in running_processes:
            await manager.broadcast(json.dumps({"type": "status", "agent": agent_name, "status": "already_running"}))
            return

        if agent_name in starting_agents:
            await manager.broadcast(json.dumps({"type": "log", "agent": agent_name, "line": f"Agent '{agent_name}' is already in the process of starting."}))
            return
        
        starting_agents.add(agent_name)

    try:
        possible_paths = [
            os.path.abspath(f"agents/{agent_name}"),
            os.path.abspath(f"agents/adk-samples/python/agents/{agent_name}")
        ]
        
        agent_path = ""
        for path in possible_paths:
            if os.path.exists(path):
                agent_path = path
                break
        
        if not agent_path:
            raise FileNotFoundError(f"Agent '{agent_name}' not found.")

        runner = AgentRunner(agent_name, agent_path, port)
        await runner.start()

        agent_url = f"http://localhost:{port}"
        running_processes[agent_name] = {"runner": runner, "url": agent_url}
        
        await manager.broadcast(json.dumps({
            "type": "status",
            "agent": agent_name,
            "status": "running",
            "pid": runner.process.pid,
            "url": agent_url
        }))

        await runner.process.wait()
        del running_processes[agent_name]
        await manager.broadcast(json.dumps({"type": "status", "agent": agent_name, "status": "stopped", "url": None}))

    except Exception as e:
        error_msg = f"An unexpected error occurred while starting {agent_name}: {e}"
        print(error_msg)
        await manager.broadcast(json.dumps({"type": "log", "agent": agent_name, "line": f"[FATAL] {error_msg}"}))
        await manager.broadcast(json.dumps({"type": "status", "agent": agent_name, "status": "failed"}))
    finally:
        starting_agents.remove(agent_name)


async def stop_agent_process(agent_name: str):
    """Stops a running ADK agent process."""
    if agent_name in running_processes:
        runner = running_processes[agent_name]["runner"]
        await runner.stop()
        return
    await manager.broadcast(json.dumps({"type": "status", "agent": agent_name, "status": "not_running"}))


async def stop_all_agents():
    """Stops all running ADK agent processes."""
    for agent_name in list(running_processes.keys()):
        await stop_agent_process(agent_name)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    
    try:
        await websocket.send_text(json.dumps({"type": "log", "agent": "server", "line": "Connection established."}))

        for agent_name, agent_info in running_processes.items():
            status_message = {
                "type": "status",
                "agent": agent_name,
                "status": "running",
                "pid": agent_info["runner"].process.pid,
                "url": agent_info["url"]
            }
            await websocket.send_text(json.dumps(status_message))

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
            elif action == "stop_all":
                asyncio.create_task(stop_all_agents())

    except WebSocketDisconnect:
        manager.disconnect(websocket)
