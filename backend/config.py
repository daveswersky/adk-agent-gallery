from pydantic import BaseModel


class AgentConfig(BaseModel):
    """Represents the runtime configuration for a single agent."""
    type: str = "adk"
    dependencies: str = "requirements.txt"
    entrypoint: str = ""
