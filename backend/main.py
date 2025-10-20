import asyncio
import json
import os
import re
import yaml
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict
from pydantic import BaseModel
import multiprocessing as mp
from backend.connection_manager import manager, running_processes, starting_agents, startup_lock
from backend.agent_runner import AgentRunner

app = FastAPI()

# Load gallery configuration
CONFIG = {}
try:
    with open("gallery.config.yaml", "r") as f:
        CONFIG = yaml.safe_load(f)
except FileNotFoundError:
    print("gallery.config.yaml not found. Using default settings.")
except yaml.YAMLError as e:
    print(f"Error parsing gallery.config.yaml: {e}")



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
    """Scans agent directories defined in the config and returns a list of available agents."""
    agents = []
    agent_roots = CONFIG.get("agent_roots", [])
    if not agent_roots:
        print("Warning: 'agent_roots' not defined in gallery.config.yaml. No agents will be loaded.")
        return []

    for root in agent_roots:
        agents_dir = os.path.abspath(root.get("path"))
        exclusions = root.get("exclude", [])
        
        if not os.path.exists(agents_dir):
            print(f"Warning: Agent directory not found: {agents_dir}")
            continue

        for agent_id in os.listdir(agents_dir):
            if agent_id in exclusions or agent_id.startswith('.'):
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
                                description = match.group(1).strip()
                    except Exception as e:
                        print(f"Could not read or parse {agent_py_path}: {e}")

                agents.append({
                    "id": os.path.join(root.get("path"), agent_id), # Use full path for ID
                    "name": agent_id,
                    "description": description,
                })
    return agents


def _get_agent_py_path(agent_path: str) -> str:
    """Helper function to find the main agent.py file, checking common structures."""
    base_name = os.path.basename(agent_path)
    module_name = base_name.replace('-', '_')
    
    possible_paths = [
        os.path.join(agent_path, module_name, "agent.py"),
        os.path.join(agent_path, base_name, "agent.py"),
        os.path.join(agent_path, "agent.py")
    ]

    for path in possible_paths:
        if os.path.exists(path):
            return path
            
    raise HTTPException(status_code=404, detail=f"Primary agent file not found for '{base_name}'.")


@app.get("/agents/{agent_name:path}/code")
async def get_agent_code(agent_name: str):
    """Finds and returns the code for a specified agent."""
    agent_path = os.path.abspath(agent_name)

    # Security: Ensure the resolved path is within one of the configured agent_roots
    agent_root_paths = [os.path.abspath(root['path']) for root in CONFIG.get('agent_roots', [])]
    if not any(agent_path.startswith(root_path) for root_path in agent_root_paths):
        raise HTTPException(status_code=403, detail="Access to this agent is forbidden.")

    if not os.path.isdir(agent_path):
        raise HTTPException(status_code=404, detail=f"Agent directory '{agent_name}' not found.")

    agent_py_path = _get_agent_py_path(agent_path)

    try:
        with open(agent_py_path, "r") as f:
            content = f.read()
        return {"filename": os.path.basename(agent_py_path), "content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading agent file: {e}")


@app.get("/agents/{agent_name:path}/code_with_subagents")
async def get_agent_code_with_subagents(agent_name: str):
    """Finds and returns the code for a specified agent and its sub-agents."""
    agent_path = os.path.abspath(agent_name)

    # Security: Ensure the resolved path is within one of the configured agent_roots
    agent_root_paths = [os.path.abspath(root['path']) for root in CONFIG.get('agent_roots', [])]
    if not any(agent_path.startswith(root_path) for root_path in agent_root_paths):
        raise HTTPException(status_code=403, detail="Access to this agent is forbidden.")
        
    if not os.path.isdir(agent_path):
        raise HTTPException(status_code=404, detail=f"Agent directory '{agent_name}' not found.")

    base_name = os.path.basename(agent_name)
    module_name = base_name.replace('-', '_')

    agent_py_path = _get_agent_py_path(agent_path)

    try:
        with open(agent_py_path, "r") as f:
            main_agent_code = f.read()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading main agent file: {e}")

    response = {
        "main_agent": {"name": base_name, "code": main_agent_code},
        "sub_agents": []
    }

    # Find sub-agents
    # The convention is that the sub-agents are in a directory named after the
    # main agent's module name.
    sub_agents_dir = os.path.join(agent_path, module_name, "sub_agents")
    if not os.path.isdir(sub_agents_dir):
        # Try the other convention
        sub_agents_dir = os.path.join(agent_path, base_name, "sub_agents")


    if os.path.isdir(sub_agents_dir):
        for sub_agent_name in os.listdir(sub_agents_dir):
            sub_agent_path = os.path.join(sub_agents_dir, sub_agent_name)
            if os.path.isdir(sub_agent_path):
                sub_agent_py_path = os.path.join(sub_agent_path, "agent.py")
                if os.path.exists(sub_agent_py_path):
                    try:
                        with open(sub_agent_py_path, "r") as f:
                            sub_agent_code = f.read()
                        response["sub_agents"].append({
                            "name": sub_agent_name,
                            "code": sub_agent_code
                        })
                    except Exception as e:
                        # Log the error but continue, so one broken sub-agent doesn't fail the whole request
                        print(f"Error reading sub-agent file {sub_agent_py_path}: {e}")

    return response

@app.post("/run_turn")
async def run_turn(request: TurnRequest):
    """Runs a single turn of the agent."""
    agent_path = request.agent_name
    prompt = request.prompt
    
    if agent_path not in running_processes:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_path}' not found or not running.")
        
    agent_info = running_processes[agent_path]
    runner = agent_info["runner"]
    
    # The runner now returns a dictionary with "response" and "events"
    turn_result = await runner.run_turn(prompt)
    return turn_result

async def start_agent_process(agent_path: str, port: int):
    """Starts and monitors an agent, ensuring cleanup on termination."""
    agent_name_for_display = os.path.basename(agent_path)
    await manager.broadcast(json.dumps({"type": "log", "agent": agent_name_for_display, "line": "Agent startup process started."}))
    
    async with startup_lock:
        if agent_path in running_processes or agent_path in starting_agents:
            status = "already_running" if agent_path in running_processes else "starting"
            await manager.broadcast(json.dumps({"type": "status", "agent": agent_path, "status": status}))
            return
        starting_agents.add(agent_path)

    runner = None
    try:
        agent_abs_path = os.path.abspath(agent_path)
        if not os.path.isdir(agent_abs_path):
            raise FileNotFoundError(f"Agent directory '{agent_path}' not found.")

        runner = AgentRunner(agent_path, agent_abs_path, port)
        await runner.start()

        agent_url = f"http://localhost:{port}"
        running_processes[agent_path] = {"runner": runner, "url": agent_url}
        starting_agents.remove(agent_path)
        
        await manager.broadcast(json.dumps({
            "type": "status",
            "agent": agent_path,
            "status": "running",
            "pid": runner.process.pid,
            "url": agent_url
        }))

        await runner.process.wait()
        print(f"--- DEBUG: Process for '{agent_name_for_display}' terminated.")

    except Exception as e:
        error_msg = f"An unexpected error occurred while starting {agent_path}: {e}"
        print(error_msg)
        await manager.broadcast(json.dumps({"type": "log", "agent": agent_name_for_display, "line": f"[FATAL] {error_msg}"}))
        await manager.broadcast(json.dumps({"type": "status", "agent": agent_path, "status": "failed"}))
    finally:
        print(f"--- DEBUG: Cleaning up state for '{agent_path}'.")
        if agent_path in running_processes:
            del running_processes[agent_path]
        if agent_path in starting_agents:
            starting_agents.remove(agent_path)
        
        await manager.broadcast(json.dumps({"type": "status", "agent": agent_path, "status": "stopped", "url": None}))
        print(f"--- DEBUG: Cleanup for '{agent_path}' complete.")


async def stop_agent_process(agent_path: str):
    """Stops a running ADK agent process."""
    agent_name_for_display = os.path.basename(agent_path)
    print(f"--- DEBUG: Received stop command for '{agent_name_for_display}' ({agent_path})")
    if agent_path in running_processes:
        runner = running_processes[agent_path]["runner"]
        print(f"--- DEBUG: Found runner. Calling runner.stop().")
        # This will terminate the process, which unblocks the 'await wait()'
        # in the original start_agent_process task.
        await runner.stop()
        return
    print(f"--- DEBUG: Agent '{agent_path}' not found in running_processes.")


async def stop_all_agents():
    """Stops all running ADK agent processes."""
    for agent_name in list(running_processes.keys()):
        await stop_agent_process(agent_name)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    
    try:
        # Send config on connect
        await websocket.send_json({"type": "config", "data": CONFIG.get("agent_roots", [])})
        
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
