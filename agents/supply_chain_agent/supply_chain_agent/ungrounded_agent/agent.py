
from google.adk.agents import LlmAgent

root_agent = LlmAgent(
    name="UngroundedAgent",
    description="A simple agent with no tools or internal knowledge.",
    instruction="You are a helpful assistant. You do not have access to any tools or internal knowledge.",
    model="gemini-2.5-flash"
)
