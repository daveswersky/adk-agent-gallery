import asyncio
import pytest
import pytest_asyncio
import websockets
import json
from typing import AsyncGenerator
from websockets.exceptions import ConnectionClosed
from websockets import State
import uvicorn
import threading
import time
from httpx import AsyncClient

# Import the FastAPI app
from backend.main import app

# --- Server Fixture ---

@pytest.fixture(scope="function")
def live_server():
    """Fixture to run the FastAPI app in a separate thread for each test function."""
    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=8000, log_level="info"))
    thread = threading.Thread(target=server.run)
    thread.daemon = True
    thread.start()
    # Give the server a moment to start up
    time.sleep(2)
    yield
    server.should_exit = True
    thread.join()

# --- Test Client Fixture ---

@pytest_asyncio.fixture
async def async_test_client() -> AsyncGenerator[AsyncClient, None]:
    """Fixture for an async test client that calls the app in-memory."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client

# --- Test Code ---

SERVER_URL = "ws://127.0.0.1:8000/ws"

async def get_message_containing(websocket, text, timeout):
    """Helper to wait for a specific message from the websocket with a timeout."""
    try:
        async with asyncio.timeout(timeout):
            while True:
                try:
                    message = await websocket.recv()
                    if text in message:
                        return json.loads(message)
                except ConnectionClosed:
                    pytest.fail("Connection was closed unexpectedly.")
    except TimeoutError:
        pytest.fail(f"Timed out waiting for message containing: {text}")
    return None

@pytest_asyncio.fixture
async def websocket_connection(live_server) -> AsyncGenerator[websockets.WebSocketClientProtocol, None]:
    """Fixture to establish a websocket connection for each test."""
    try:
        async with websockets.connect(SERVER_URL) as websocket:
            yield websocket
    except ConnectionRefusedError:
        pytest.fail("Connection to the test server was refused.")

@pytest.mark.asyncio
async def test_websocket_connection(websocket_connection: websockets.WebSocketClientProtocol):
    """Tests if a client can successfully connect to the WebSocket server."""
    assert websocket_connection.state == State.OPEN

@pytest.mark.asyncio
async def test_start_and_stop_agent(websocket_connection: websockets.WebSocketClientProtocol):
    """Tests the full lifecycle of starting and stopping a single agent."""
    websocket = websocket_connection
    
    start_command = {"action": "start", "agent_name": "greeting_agent", "port": 8001}
    await websocket.send(json.dumps(start_command))

    running_message = await get_message_containing(websocket, '"status": "running"', timeout=30)
    assert running_message is not None
    assert running_message["agent"] == "greeting_agent"

    stop_command = {"action": "stop", "agent_name": "greeting_agent"}
    await websocket.send(json.dumps(stop_command))

    stopped_message = await get_message_containing(websocket, '"status": "stopped"', timeout=10)
    assert stopped_message is not None
    assert stopped_message["agent"] == "greeting_agent"

@pytest.mark.asyncio
async def test_stop_all_agents(websocket_connection: websockets.WebSocketClientProtocol):
    """Tests the 'stop_all' functionality."""
    websocket = websocket_connection

    await websocket.send(json.dumps({"action": "start", "agent_name": "greeting_agent", "port": 8001}))
    await websocket.send(json.dumps({"action": "start", "agent_name": "weather_agent", "port": 8002}))

    running_agents = set()
    for _ in range(2):
        msg = await get_message_containing(websocket, '"status": "running"', timeout=40)
        running_agents.add(msg["agent"])
    
    assert "greeting_agent" in running_agents
    assert "weather_agent" in running_agents

    await websocket.send(json.dumps({"action": "stop_all"}))

    stopped_agents = set()
    for _ in range(2):
        msg = await get_message_containing(websocket, '"status": "stopped"', timeout=20)
        stopped_agents.add(msg["agent"])

    assert "greeting_agent" in stopped_agents
    assert "weather_agent" in stopped_agents
