import argparse
import asyncio
import importlib.util
import os
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai.types import Content, Part
import uvicorn



# Add logging to confirm the environment variable is being set properly
print(f"GOOGLE_API_KEY: {os.environ.get('GOOGLE_API_KEY')}", file=sys.stderr, flush=True)

# Add the parent directory to the Python path to allow for relative imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Loads the agent and session on startup."""
    parser = argparse.ArgumentParser(description="Agent Host Server")
    parser.add_argument("--agent-path", required=True, help="The path to the agent's root directory.")
    parser.add_argument("--port", type=int, required=True, help="The port to run the server on.")
    # NOTE: This is a bit of a hack to get the command-line args.
    # A better solution would be to use environment variables.
    args, _ = parser.parse_known_args()

    # Dynamically load the agent from the specified path
    app_name = os.path.basename(args.agent_path)
    module_name = app_name.replace('-', '_')
    agent_module_path = os.path.join(args.agent_path, module_name, "agent.py")

    spec = importlib.util.spec_from_file_location("agent_main", agent_module_path)
    agent_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(agent_module)
    
    root_agent = agent_module.root_agent
    session_service = InMemorySessionService()
    app.state.agent_runner = Runner(
        agent=root_agent, 
        session_service=session_service,
        app_name=app_name
    )
    app.state.agent_session = await session_service.create_session(
        session_id="test_session",
        app_name=app_name,
        user_id="test_user"
    )
    yield

app = FastAPI(lifespan=lifespan)

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.post("/")
async def run_turn(request: Request):
    """Runs a single turn of the agent."""
    agent_session = request.app.state.agent_session
    agent_runner = request.app.state.agent_runner
    if not agent_session or not agent_runner:
        return {"error": "Agent not loaded"}, 500
    
    try:
        data = await request.json()
        prompt = data.get("prompt")
        if not prompt:
            return {"error": "Prompt not provided"}, 400

        response_generator = agent_runner.run_async(
            user_id=agent_session.user_id,
            session_id=agent_session.id,
            new_message=Content(parts=[Part(text=prompt)])
        )
        
        response_chunks = []
        async for chunk in response_generator:
            if hasattr(chunk, 'content') and chunk.content.parts:
                for part in chunk.content.parts:
                    if hasattr(part, 'text'):
                        response_chunks.append(part.text)

        response = "".join(response_chunks)
        return {"response": response}
    except Exception as e:
        print(f"Error running agent: {e}", file=sys.stderr)
        raise

def main():
    """Starts the server."""
    parser = argparse.ArgumentParser(description="Agent Host Server")
    parser.add_argument("--agent-path", required=True, help="The path to the agent's root directory.")
    parser.add_argument("--port", type=int, required=True, help="The port to run the server on.")
    args = parser.parse_args()
    uvicorn.run(app, host="0.0.0.0", port=args.port)

if __name__ == "__main__":
    main()
