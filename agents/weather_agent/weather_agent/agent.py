from google.adk.agents import LlmAgent

root_agent = LlmAgent(
    model="gemini-2.5-flash",
    name="WeatherAgent",
    instruction="You are a helpful agent that provides weather information. Your response should be short and sweet.",
    description="A simple agent that provides weather forecasts.",
)
