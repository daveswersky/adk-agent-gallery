import asyncio
import json
import os
import re
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict
from backend.connection_manager import manager, running_processes, starting_agents, startup_lock

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
    for agent_name, agent_info in list(running_processes.items()):
        process = agent_info["process"]
        print(f"Stopping agent: {agent_name} (PID: {process.pid})")
        process.terminate()
        try:
            # Wait for the process to terminate
            await asyncio.wait_for(process.wait(), timeout=5.0)
            print(f"Agent {agent_name} terminated successfully.")
        except asyncio.TimeoutError:
            print(f"Agent {agent_name} did not terminate in time, killing.")
            process.kill()
        except Exception as e:
            print(f"Error terminating agent {agent_name}: {e}")
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
                
                # Convert agent_id from kebab-case to snake_case for the python module
                module_name = agent_id.replace('-', '_')

                # Look for the agent.py file to extract a better description
                # The module directory is not always the same as the agent_id
                nested_agent_path = os.path.join(agent_path, module_name)
                if not os.path.exists(nested_agent_path):
                    nested_agent_path = os.path.join(agent_path, agent_id)

                agent_py_path = os.path.join(nested_agent_path, "agent.py")

                if os.path.exists(agent_py_path):
                    try:
                        with open(agent_py_path, "r") as f:
                            content = f.read()
                            # Use regex to find the description in the LlmAgent constructor
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
        # Determine the correct path for the agent
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
            await manager.broadcast(json.dumps({"type": "log", "agent": agent_name, "line": f"[ERROR] Agent '{agent_name}' not found."}))
            await manager.broadcast(json.dumps({"type": "status", "agent": agent_name, "status": "failed"}))
            return

        venv_path = os.path.join(agent_path, ".venv")
        python_executable = os.path.join(venv_path, "bin", "python")
        requirements_path = os.path.join(agent_path, "requirements.txt")
        uv_executable = os.path.join(venv_path, "bin", "uv")

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
                await manager.broadcast(json.dumps({"type": "log", "agent": agent_name, "line": "Waiting for venv creation to complete..."}))
                await proc.wait()
                await manager.broadcast(json.dumps({"type": "log", "agent": agent_name, "line": "Venv creation complete."}))

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
                await manager.broadcast(json.dumps({"type": "log", "agent": agent_name, "line": "Waiting for uv installation to complete..."}))
                await proc.wait()
                await manager.broadcast(json.dumps({"type": "log", "agent": agent_name, "line": "uv installation complete."}))

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
                await manager.broadcast(json.dumps({"type": "log", "agent": agent_name, "line": "Waiting for uv installation to complete..."}))
                await proc.wait()
                await manager.broadcast(json.dumps({"type": "log", "agent": agent_name, "line": "uv installation complete."}))

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

        # 3. Install dependencies if requirements.txt or pyproject.toml exists
        pyproject_path = os.path.join(agent_path, "pyproject.toml")
        install_command_args = []
        if os.path.exists(requirements_path):
            install_command_args = ["pip", "install", "-r", "requirements.txt"]
        elif os.path.exists(pyproject_path):
            install_command_args = ["pip", "install", "-e", "."]

        if install_command_args:
            await manager.broadcast(json.dumps({"type": "status", "agent": agent_name, "status": "installing_dependencies"}))
            try:
                # Set the VIRTUAL_ENV environment variable to mimic venv activation
                env = os.environ.copy()
                env["VIRTUAL_ENV"] = venv_path

                proc = await asyncio.create_subprocess_exec(
                    uv_executable, *install_command_args,
                    cwd=agent_path,
                    env=env,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                # Stream pip install output
                asyncio.create_task(read_pip_stream(proc.stdout, agent_name, False))
                asyncio.create_task(read_pip_stream(proc.stderr, agent_name, True))
                await manager.broadcast(json.dumps({"type": "log", "agent": agent_name, "line": "Waiting for dependency installation to complete..."}))
                await proc.wait()
                await manager.broadcast(json.dumps({"type": "log", "agent": agent_name, "line": "Dependency installation complete."}))

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
        env = os.environ.copy()
        env["VIRTUAL_ENV"] = venv_path
        # Add the parent directory of the agent code to the Python path
        env["PYTHONPATH"] = agent_path

        # If ADK is not found after installing from requirements, try to install it directly.
        if not os.path.exists(adk_executable):
            await manager.broadcast(json.dumps({
                "type": "log", "agent": agent_name, "line": "ADK executable not found. Attempting direct installation of google-adk..."
            }))
            try:
                proc = await asyncio.create_subprocess_exec(
                    uv_executable, "pip", "install", "google-adk",
                    cwd=agent_path,
                    env=env,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                # Stream pip install output
                asyncio.create_task(read_pip_stream(proc.stdout, agent_name, False))
                asyncio.create_task(read_pip_stream(proc.stderr, agent_name, True))
                await proc.wait()

                if proc.returncode != 0:
                    error_msg = "Failed to install google-adk directly."
                    await manager.broadcast(json.dumps({"type": "log", "agent": agent_name, "line": f"[ERROR] {error_msg}"}))
                    await manager.broadcast(json.dumps({"type": "status", "agent": agent_name, "status": "failed"}))
                    return
                
                await manager.broadcast(json.dumps({"type": "log", "agent": agent_name, "line": "Direct installation of google-adk successful."}))

            except Exception as e:
                error_msg = f"Exception during direct google-adk installation: {e}"
                await manager.broadcast(json.dumps({"type": "log", "agent": agent_name, "line": f"[ERROR] {error_msg}"}))
                await manager.broadcast(json.dumps({"type": "status", "agent": agent_name, "status": "failed"}))
                return

        # Final check for the ADK executable
        if not os.path.exists(adk_executable):
            await manager.broadcast(json.dumps({
                "type": "log", "agent": agent_name, "line": "[ERROR] ADK executable still not found after direct installation."
            }))
            await manager.broadcast(json.dumps({"type": "status", "agent": agent_name, "status": "failed"}))
            return

        # Determine the module name to use for the ADK command.
        # This unconditionally replaces dashes with underscores to match Python module naming conventions.
        module_name = agent_name.replace('-', '_')
        command = [adk_executable, "api_server", module_name]
        
        command.extend(["--port", str(port), "--allow_origins", "*"])

        process = await asyncio.create_subprocess_exec(
            *command,
            cwd=agent_path,
            env=env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        started_event = asyncio.Event()

        # Read both stdout and stderr to find the startup message
        asyncio.create_task(read_stream_and_signal_start(process.stdout, agent_name, False, started_event))
        asyncio.create_task(read_stream_and_signal_start(process.stderr, agent_name, True, started_event))

        # Wait for the startup message before broadcasting the running status
        await started_event.wait()

        agent_url = f"http://localhost:{port}"
        running_processes[agent_name] = {"process": process, "url": agent_url}
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
    finally:
        starting_agents.remove(agent_name)


async def stop_agent_process(agent_name: str):
    """Stops a running ADK agent process."""
    if agent_name in running_processes:
        process = running_processes[agent_name]["process"]
        process.terminate()
        await process.wait()
        return
    await manager.broadcast(json.dumps({"type": "status", "agent": agent_name, "status": "not_running"}))


async def stop_all_agents():
    """Stops all running ADK agent processes."""
    for agent_name in list(running_processes.keys()):
        await stop_agent_process(agent_name)


async def start_agent_with_error_handling(agent_name: str, port: int):
    """Wrapper to catch and report exceptions from start_agent_process."""
    try:
        await start_agent_process(agent_name, port)
    except Exception as e:
        error_msg = f"An unexpected error occurred while starting {agent_name}: {e}"
        print(error_msg)  # Also log to server console
        await manager.broadcast(json.dumps({
            "type": "log", "agent": agent_name, "line": f"[FATAL] {error_msg}"
        }))
        await manager.broadcast(json.dumps({
            "type": "status", "agent": agent_name, "status": "failed"
        }))

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    
    try:
        # Send a welcome message to the newly connected client
        await websocket.send_text(json.dumps({"type": "log", "agent": "server", "line": "Connection established."}))

        # Upon connection, send the current status of all running agents to the new client
        for agent_name, agent_info in running_processes.items():
            status__message = {
                "type": "status",
                "agent": agent_name,
                "status": "running",
                "pid": agent_info["process"].pid,
                "url": agent_info["url"]
            }
            await websocket.send_text(json.dumps(status__message))

        while True:
            data = await websocket.receive_text()
            command = json.loads(data)
            
            action = command.get("action")
            agent_name = command.get("agent_name")

            if action == "start":
                port = command.get("port")
                if port:
                    asyncio.create_task(start_agent_with_error_handling(agent_name, port))
            elif action == "stop":
                asyncio.create_task(stop_agent_process(agent_name))
            elif action == "stop_all":
                asyncio.create_task(stop_all_agents())

    except WebSocketDisconnect:
        manager.disconnect(websocket)
