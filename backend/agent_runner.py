import asyncio
import json
import os
from typing import Optional, List
import httpx

from backend.base_agent_runner import BaseAgentRunner
from backend.connection_manager import manager
from backend.config import AgentConfig


class AgentRunner(BaseAgentRunner):
    """Manages the lifecycle of a single ADK agent subprocess by running the generic agent_host."""

    def __init__(self, agent_path: str, agent_abs_path: str, port: int, config: AgentConfig):
        super().__init__(agent_path, agent_abs_path, port, config)
        self.event_protocol: Optional[asyncio.Protocol] = None # Specific to ADK agents for now

    def _get_dependency_install_command(self) -> List[str]:
        """Returns the command to install dependencies from requirements.txt."""
        venv_path = os.path.join(self.agent_abs_path, ".venv")
        uv_executable = os.path.join(venv_path, "bin", "uv")
        requirements_path = os.path.join(self.agent_abs_path, "requirements.txt")
        
        # ADK agents also need the host's dependencies
        host_requirements_path = os.path.abspath("backend/agent_host_requirements.txt")

        # We will install both in one go if the agent has its own requirements
        if os.path.exists(requirements_path):
            return [uv_executable, "pip", "install", "-r", requirements_path, "-r", host_requirements_path]
        else:
            return [uv_executable, "pip", "install", "-r", host_requirements_path]


    def _get_agent_execution_command(self) -> List[str]:
        """Returns the command to execute the generic agent_host.py for an ADK agent."""
        venv_path = os.path.join(self.agent_abs_path, ".venv")
        python_executable = os.path.join(venv_path, "bin", "python")
        agent_host_script = os.path.abspath("backend/agent_host.py")

        # Note: Event pipe is not handled in the base class start() method yet.
        # This will need to be refactored if we want to generalize it.
        # For now, we focus on getting the process running.
        # read_fd, write_fd = os.pipe() 

        return [
            python_executable, 
            "-u",
            agent_host_script, 
            "--agent-path", self.agent_path, 
            "--port", str(self.port),
            # "--event-pipe-fd", str(write_fd), # TODO: Refactor event pipe
            "--verbose"
        ]

    async def run_turn(self, prompt: str) -> dict:
        """Sends a prompt to the agent and returns the response."""
        url = f"http://localhost:{self.port}/"
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, json={"prompt": prompt}, timeout=300.0)
                response.raise_for_status()
                
                agent_response = response.json().get("response", "")
                
                return {"response": agent_response}

            except httpx.RequestError as e:
                await manager.broadcast(json.dumps({"type": "log", "agent": self.agent_name, "line": f"[ERROR] Could not connect to agent: {e}"}))
                return {"response": "Error: Could not connect to the agent."}