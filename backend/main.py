import asyncio
import json
import os
import re
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict
from pydantic import BaseModel
import multiprocessing as mp
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

class TurnRequest(BaseModel):
    agent_name: str
    prompt: str

@app.on_event("shutdown")
async def shutdown_event():
    """Gracefully terminate all running agent subprocesses on server shutdown."""
    print("Server shutting down. Terminating agent processes...")
    for agent_name, agent_info in list(running_processes.items()):
        if isinstance(agent_info, dict) and "runner" in agent_info:
            runner = agent_info["runner"]
            if isinstance(runner, AgentRunner):
                print(f"Stopping agent: {agent_name}")
                await runner.stop()
    running_processes.clear()
    print("All agent processes terminated.")

@app.get("/agents")
async def get_agents():
    """Scans agent directories and returns a list of available agents."""
    agents = []
    seen_agents = set()
    project_root = os.path.abspath(".")
    
    # Primary agents directory
    primary_agents_dir = os.path.abspath("agents")
    if os.path.exists(primary_agents_dir):
        for agent_id in os.listdir(primary_agents_dir):
            if agent_id.startswith('.') or agent_id == '__pycache__' or agent_id == 'adk-samples':
                continue
            agent_path = os.path.join(primary_agents_dir, agent_id)
            if os.path.isdir(agent_path):
                relative_path = os.path.relpath(agent_path, project_root)
                agent_name = relative_path.replace(os.path.sep, '/')
                if agent_name in seen_agents:
                    continue
                
                description = f"The {agent_id} agent."
                agent_py_path = os.path.join(agent_path, agent_id.replace('-', '_'), "agent.py")
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
                    "id": agent_name,
                    "name": agent_name,
                    "description": description,
                })
                seen_agents.add(agent_name)

    # Special handling for adk-samples
    adk_samples_dir = os.path.abspath("agents/adk-samples/python/agents")
    if os.path.exists(adk_samples_dir):
        for agent_id in os.listdir(adk_samples_dir):
            if agent_id.startswith('.') or agent_id == '__pycache__':
                continue
            agent_path = os.path.join(adk_samples_dir, agent_id)
            if os.path.isdir(agent_path):
                relative_path = os.path.relpath(agent_path, project_root)
                agent_name = relative_path.replace(os.path.sep, '/')
                if agent_name in seen_agents:
                    continue

                description = f"The {agent_id} agent."
                agent_py_path = os.path.join(agent_path, agent_id.replace('-', '_'), "agent.py")
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
                    "id": agent_name,
                    "name": agent_name,
                    "description": description,
                })
                seen_agents.add(agent_name)

    return agents

@app.get("/agents/{agent_name:path}/code")
async def get_agent_code(agent_name: str):
    """Finds and returns the code for a specified agent."""
    agent_path = os.path.abspath(agent_name)
    if not os.path.exists(agent_path):
        raise HTTPException(status_code=404, detail=f"Agent directory '{agent_path}' not found.")

    # The agent's primary code file could be in a nested directory named after the
    # agent, or directly in the root. We need to check both.
    agent_id = os.path.basename(agent_name)
    module_name = agent_id.replace('-', '_')
    
    possible_files = [
        os.path.join(agent_path, module_name, "agent.py"),
        os.path.join(agent_path, "agent.py"),
        os.path.join(agent_path, "main.py"), # Some agents might use main.py
    ]
    
    agent_py_path = next((path for path in possible_files if os.path.exists(path)), None)

    if not agent_py_path:
        raise HTTPException(status_code=404, detail=f"Primary agent file not found for '{agent_name}'. Looked in: {possible_files}")

    try:
        with open(agent_py_path, "r") as f:
            content = f.read()
        return {"filename": os.path.basename(agent_py_path), "content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading agent file: {e}")

@app.post("/run_turn")
async def run_turn(request: TurnRequest):
    """Runs a single turn of the agent."""
    agent_name = request.agent_name
    prompt = request.prompt
    
    if agent_name not in running_processes:
        raise HTTPException(status_code=404, detail="Agent not found or not running.")
        
    agent_info = running_processes[agent_name]
    runner = agent_info["runner"]
    
    # The runner now returns a dictionary with "response" and "events"
    turn_result = await runner.run_turn(prompt)
    return turn_result

async def start_agent_process(agent_name: str, port: int):
    """Starts and monitors an agent, ensuring cleanup on termination."""
    await manager.broadcast(json.dumps({"type": "log", "agent": agent_name, "line": "Agent startup process started."}))
    
    async with startup_lock:
        if agent_name in running_processes or agent_name in starting_agents:
            status = "already_running" if agent_name in running_processes else "starting"
            await manager.broadcast(json.dumps({"type": "status", "agent": agent_name, "status": status}))
            return
        starting_agents.add(agent_name)

    runner = None
    try:
        # The agent_name is now the full relative path, so we can use it directly.
        agent_path = os.path.abspath(agent_name)
        if not os.path.exists(agent_path):
            raise FileNotFoundError(f"Agent directory '{agent_path}' not found.")

        runner = AgentRunner(agent_name, agent_path, port)
        await runner.start()

        agent_url = f"http://localhost:{port}"
        running_processes[agent_name] = {"runner": runner, "url": agent_url}
        starting_agents.remove(agent_name)
        
        await manager.broadcast(json.dumps({
            "type": "status",
            "agent": agent_name,
            "status": "running",
            "pid": runner.process.pid,
            "url": agent_url
        }))

        await runner.process.wait()
        print(f"--- DEBUG: Process for '{agent_name}' terminated.")

    except Exception as e:
        error_msg = f"An unexpected error occurred while starting {agent_name}: {e}"
        print(error_msg)
        await manager.broadcast(json.dumps({"type": "log", "agent": agent_name, "line": f"[FATAL] {error_msg}"}))
        await manager.broadcast(json.dumps({"type": "status", "agent": agent_name, "status": "failed"}))
    finally:
        print(f"--- DEBUG: Cleaning up state for '{agent_name}'.")
        if agent_name in running_processes:
            del running_processes[agent_name]
        if agent_name in starting_agents:
            starting_agents.remove(agent_name)
        
        await manager.broadcast(json.dumps({"type": "status", "agent": agent_name, "status": "stopped", "url": None}))
        print(f"--- DEBUG: Cleanup for '{agent_name}' complete.")


async def stop_agent_process(agent_name: str):
    """Stops a running ADK agent process."""
    print(f"--- DEBUG: Received stop command for '{agent_name}'")
    if agent_name in running_processes:
        runner = running_processes[agent_name]["runner"]
        print(f"--- DEBUG: Found runner. Calling runner.stop().")
        # This will terminate the process, which unblocks the 'await wait()'
        # in the original start_agent_process task.
        await runner.stop()
        return
    print(f"--- DEBUG: Agent '{agent_name}' not found in running_processes.")


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
            runner = agent_info.get("runner")
            # Only send status if the runner and its process exist and are still running.
            if runner and runner.process and runner.process.returncode is None:
                status_message = {
                    "type": "status",
                    "agent": agent_name,
                    "status": "running",
                    "pid": runner.process.pid,
                    "url": agent_info.get("url")
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
        # In the context of the E2E tests, a disconnect signifies the end of a
        # test run. To prevent state from leaking between tests, we will stop
        # all running agents.
        # NOTE: In a multi-client production environment, this would be unsafe
        # as it would terminate agents for all connected clients. A more robust
        # solution would involve associating agent processes with specific
        # WebSocket connections.
        print("Client disconnected. Stopping all agents to clean up test state.")
        asyncio.create_task(stop_all_agents())
        manager.disconnect(websocket)
