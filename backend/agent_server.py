import sys
import importlib.util
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from google.adk.runtime import serve
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
import uvicorn

# A single session service instance to be shared across the server.
# This ensures that the REST endpoints (for session creation) and the
# WebSocket endpoint operate on the same set of in-memory sessions.
SESSION_SERVICE = InMemorySessionService()

def load_agent_from_path(agent_module_path: str):
    """Loads the 'agent' object from the specified agent module file."""
    try:
        spec = importlib.util.spec_from_file_location("agent_module", agent_module_path)
        if spec is None or spec.loader is None:
            raise ImportError(f"Could not create module spec from {agent_module_path}")
        agent_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(agent_module)
        if not hasattr(agent_module, "agent"):
            raise AttributeError(f"Module at {agent_module_path} does not have an 'agent' attribute.")
        return agent_module.agent
    except Exception as e:
        print(f"Error loading agent from {agent_module_path}: {e}")
        sys.exit(1)

def create_app(agent_path: str) -> FastAPI:
    """Creates a FastAPI app with ADK REST endpoints and a custom WebSocket endpoint."""
    agent_app = load_agent_from_path(agent_path)

    # This runner is used by the standard ADK REST endpoints.
    runner_for_rest = Runner(app=agent_app, session_service=SESSION_SERVICE)

    # This function from the ADK creates a FastAPI app with all the standard
    # endpoints like /run, /execute, and session management.
    app = serve.from_runner(runner_for_rest)

    @app.websocket("/ws/agent_events")
    async def agent_events_ws(websocket: WebSocket):
        await websocket.accept()
        try:
            params = await websocket.receive_json()
            user_id = params.get("user_id")
            session_id = params.get("session_id")
            user_message = params.get("user_message")

            if not all([user_id, session_id, user_message]):
                raise ValueError("Missing required parameters in websocket message.")

            # This runner handles the streaming logic for the WebSocket connection.
            # It shares the same session service as the REST endpoints.
            runner_for_ws = Runner(app=agent_app, session_service=SESSION_SERVICE)

            async for event in runner_for_ws.run_async(
                user_id=user_id,
                session_id=session_id,
                new_message=user_message
            ):
                await websocket.send_json(event.model_dump(exclude_none=True))

        except WebSocketDisconnect:
            print("Client disconnected.")
        except Exception as e:
            print(f"Error in websocket endpoint: {e}")
            await websocket.close(code=1011, reason=str(e))
        finally:
            # Ensure the websocket is closed if it's still open.
            if websocket.client_state.name != 'DISCONNECTED':
                await websocket.close()

    return app

def main():
    """Main entry point to run the custom agent server."""
    if len(sys.argv) < 3:
        print("Usage: python agent_server.py <path_to_agent_py> <port>")
        sys.exit(1)

    agent_path_arg = sys.argv[1]
    port_arg = int(sys.argv[2])

    fastapi_app = create_app(agent_path_arg)
    uvicorn.run(fastapi_app, host="0.0.0.0", port=port_arg)

if __name__ == "__main__":
    main()
