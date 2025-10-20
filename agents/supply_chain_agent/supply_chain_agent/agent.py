# agent.py

from google.adk.agents import LlmAgent
from google.adk.tools.agent_tool import AgentTool
from .sub_agents.impact_agent.agent import root_agent as impact_agent
from .sub_agents.research_agent.agent import root_agent as research_agent

root_agent = LlmAgent(
    name="RapidResolveAgent",
    description="A proactive agent that assesses impact and finds solutions for supply chain disruptions by orchestrating sub-agents.",
    instruction="""
        You are the RapidResolve Agent, a proactive supply chain co-pilot that orchestrates specialist sub-agents.
        Your goal is to comprehensively respond to supply chain disruption alerts.

        When you receive a disruption alert, you MUST use your specialist agent tools in this exact sequence:
        1. First, call the `ImpactAgent` tool to understand the scope of the problem.
        2. Second, call the `ResearchAgent` tool to find mitigation strategies from the corporate knowledge base.
        3. Finally, synthesize all the information from the tools into a single, clear, actionable recommendation for the user.

        Present the final output in a clean, readable format.
    """,
    model="gemini-2.5-flash",
    tools=[
        AgentTool(agent=impact_agent),
        AgentTool(agent=research_agent),
    ],
)