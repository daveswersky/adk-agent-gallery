
from google.adk.agents import LlmAgent
from ...tools.knowledge_retriever import research_solutions

MODEL = "gemini-2.5-flash"

root_agent = LlmAgent(
    name="ResearchAgent",
    model=MODEL,
    description="A specialist agent that researches solutions to problems from a corporate knowledge base.",
    instruction="""Your purpose is to answer a user's query using the corporate knowledge base.

To do this, you MUST follow these steps:
1. Call the `research_solutions` tool with the user's original query. This tool will return a complete, pre-formatted prompt containing the relevant knowledge base data.
2. Take the entire prompt string returned by the tool and execute it using your own language model to generate the final, grounded answer.
""",
    tools=[research_solutions],
)
