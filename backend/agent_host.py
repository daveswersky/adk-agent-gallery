import argparse
import asyncio
import importlib.util
import os
import sys
import traceback
import ast

# Add the parent directory to the Python path to allow for relative imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from contextlib import asynccontextmanager
from multiprocessing.managers import BaseManager
from multiprocessing import Queue
from fastapi import FastAPI, Request
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai.types import Content, Part
import uvicorn
from backend.event_streaming_plugin import EventStreamingPlugin

# --- Environment Variable Loading and Debugging ---

def mask_api_key(api_key):
    """Masks the API key, showing only the first 4 and last 4 characters."""
    if not api_key or len(api_key) < 9:
        return api_key
    return f"{api_key[:4]}...{api_key[-4:]}"

def load_env_file(filepath, verbose=False):
    """Manually reads a .env file and sets environment variables."""
    if not os.path.exists(filepath):
        if verbose:
            print(f"DEBUG: .env file not found at {filepath}", file=sys.stderr, flush=True)
        return
    
    if verbose:
        print(f"DEBUG: Manually parsing .env file at: {filepath}", file=sys.stderr, flush=True)
    
    with open(filepath, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                key = key.strip()
                value = value.strip()
                # Strip quotes
                if value.startswith('"') and value.endswith('"'):
                    value = value[1:-1]
                elif value.startswith("'") and value.endswith("'"):
                    value = value[1:-1]
                
                if key:
                    os.environ[key] = value
                    if verbose:
                        print(f"DEBUG: Manually set env var: {key}", file=sys.stderr, flush=True)

# --- Argument Parsing ---
# We need to parse args early to decide if we should be verbose
parser = argparse.ArgumentParser(description="Agent Host Server")
parser.add_argument("--agent-path", required=True, help="The path to the agent's root directory.")
parser.add_argument("--port", type=int, required=True, help="The port to run the server on.")
parser.add_argument("--event-queue-id", type=str, help="The ID of the event queue.")
parser.add_argument("--verbose", action="store_true", help="Enable verbose debugging output.")
parser.add_argument("--manager-address", help="The address of the multiprocessing manager.")
parser.add_argument("--manager-authkey", help="The authkey for the multiprocessing manager.")
# Use parse_known_args to avoid conflicts with uvicorn's args
args, _ = parser.parse_known_args()

# --- Environment Loading ---
dotenv_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '.env'))
load_env_file(dotenv_path, verbose=args.verbose)

google_api_key = os.environ.get("GOOGLE_API_KEY")
gemini_api_key = os.environ.get("GEMINI_API_KEY")

if args.verbose:
    print(f"DEBUG: Initial GOOGLE_API_KEY: {mask_api_key(google_api_key)}", file=sys.stderr, flush=True)
    print(f"DEBUG: Initial GEMINI_API_KEY: {mask_api_key(gemini_api_key)}", file=sys.stderr, flush=True)

if not google_api_key and gemini_api_key:
    if args.verbose:
        print("DEBUG: GOOGLE_API_KEY not found. Using GEMINI_API_KEY as a fallback.", file=sys.stderr, flush=True)
    os.environ["GOOGLE_API_KEY"] = gemini_api_key

if args.verbose:
    print(f"INFO: Final GOOGLE_API_KEY: {mask_api_key(os.environ.get('GOOGLE_API_KEY'))}", file=sys.stderr, flush=True)
# --- End of Environment Loading ---


# Add the parent directory to the Python path to allow for relative imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Loads the agent and session on startup."""
    try:
        # Dynamically load the agent from the specified path
        app_name = os.path.basename(args.agent_path)
        module_name = app_name.replace('-', '_')

        # Add agent's root directory to sys.path to allow for package-based imports
        sys.path.insert(0, args.agent_path)

        try:
            # Import the agent module as part of a package
            agent_module = importlib.import_module(f"{module_name}.agent")
            root_agent = agent_module.root_agent
        finally:
            # Clean up sys.path
            sys.path.pop(0)

        session_service = InMemorySessionService()

        plugins = []
        if args.event_queue_id and args.manager_address and args.manager_authkey:
            # The manager is created in the parent process. We connect to it here.
            class QueueManager(BaseManager):
                pass
            
            QueueManager.register('dict')
            
            manager_address = ast.literal_eval(args.manager_address)
            manager_authkey = bytes.fromhex(args.manager_authkey)

            manager = QueueManager(address=manager_address, authkey=manager_authkey)
            manager.connect()

            shared_dict = manager.dict()
            event_queue = shared_dict[args.event_queue_id]
            plugins.append(EventStreamingPlugin(queue=event_queue))

        app.state.agent_runner = Runner(
            agent=root_agent, 
            session_service=session_service,
            app_name=app_name,
            plugins=plugins
        )
        app.state.agent_session = await session_service.create_session(
            session_id="test_session",
            app_name=app_name,
            user_id="test_user"
        )
    except Exception as e:
        print(f"Error during agent loading: {e}", file=sys.stderr, flush=True)
        traceback.print_exc(file=sys.stderr)
        # We yield to avoid crashing the server on startup,
        # but the agent will not be loaded. The run_turn endpoint will
        # catch this and return an informative error.
    yield

app = FastAPI(lifespan=lifespan)

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.post("/")
async def run_turn(request: Request):
    """Runs a single turn of the agent."""
    agent_session = getattr(request.app.state, 'agent_session', None)
    agent_runner = getattr(request.app.state, 'agent_runner', None)
    if not agent_session or not agent_runner:
        return {"error": "Agent not loaded due to a startup error. Check the agent host's logs for details."}, 500
    
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
    # Re-parse args for the main function scope, this time without parse_known_args
    # as uvicorn will not be in the way.
    parser = argparse.ArgumentParser(description="Agent Host Server")
    parser.add_argument("--agent-path", required=True, help="The path to the agent's root directory.")
    parser.add_argument("--port", type=int, required=True, help="The port to run the server on.")
    parser.add_argument("--event-queue-id", type=str, help="The ID of the event queue.")
    parser.add_argument("--verbose", action="store_true", help="Enable verbose debugging output.")
    parser.add_argument("--manager-address", help="The address of the multiprocessing manager.")
    parser.add_argument("--manager-authkey", help="The authkey for the multiprocessing manager.")
    final_args = parser.parse_args()
    uvicorn.run(app, host="0.0.0.0", port=final_args.port)

if __name__ == "__main__":
    main()
