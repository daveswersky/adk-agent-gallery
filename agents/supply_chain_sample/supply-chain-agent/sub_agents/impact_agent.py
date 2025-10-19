
from google.adk.agents import LlmAgent
from ..tools.impact_calculator import calculate_impact

MODEL = "gemini-2.5-flash"

root_agent = LlmAgent(
    name="ImpactAgent",
    model=MODEL,
    description="A specialist agent that calculates the financial impact of a supply chain disruption.",
    instruction="Your sole purpose is to use the calculate_impact tool with the information provided in the user's request.",
    tools=[calculate_impact],
)
