from google.adk.agents import LlmAgent

agent = LlmAgent(
    model="gemini-1.5-flash-001",
    name="WeatherAgent",
    instruction="You are a helpful agent that provides weather information. Your response should be short and sweet.",
    description="A simple agent that provides weather forecasts.",
)