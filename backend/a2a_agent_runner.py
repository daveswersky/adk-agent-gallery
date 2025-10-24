import os
from typing import List

from backend.base_agent_runner import BaseAgentRunner
from backend.config import AgentConfig


class A2AAgentRunner(BaseAgentRunner):
    """Manages the lifecycle of a single self-hosted A2A agent subprocess."""

    def __init__(self, agent_path: str, agent_abs_path: str, port: int, config: AgentConfig):
        super().__init__(agent_path, agent_abs_path, port, config)

    def _get_dependency_install_command(self) -> List[str]:
        """Returns the command to install dependencies based on the agent's config."""
        venv_path = os.path.join(self.agent_abs_path, ".venv")
        uv_executable = os.path.join(venv_path, "bin", "uv")

        if self.config.dependencies == "pyproject.toml":
            return [uv_executable, "pip", "install", "."]
        elif self.config.dependencies == "requirements.txt":
            return [uv_executable, "pip", "install", "-r", os.path.join(self.agent_abs_path, "requirements.txt")]
        
        # Return an empty list if no known dependency file is specified
        return []

    def _get_agent_execution_command(self, event_pipe_fd: int) -> List[str]:
        """Returns the command to execute the agent's entrypoint."""
        venv_path = os.path.join(self.agent_abs_path, ".venv")
        python_executable = os.path.join(venv_path, "bin", "python")

        return [
            python_executable,
            "-m",
            self.config.entrypoint,
        ]

    def _get_agent_execution_cwd(self) -> str:
        """Returns the parent directory of the agent, for package resolution."""
        return os.path.dirname(self.agent_abs_path)

    async def run_turn(self, prompt: str):
        """A2A agents handle their own turns. This method is a placeholder."""
        # This should not be called for A2A agents.
        # The frontend should communicate directly with the agent's server.
        print("WARNING: A2AAgentRunner.run_turn was called. This indicates a misconfiguration.")
        return {"response": "Error: A2A agent turn management is not handled by the gallery host."}