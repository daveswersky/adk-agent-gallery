# Gemini Code Understanding

## Project Overview

This project is a web-based "Agent Gallery" that allows users to manage and interact with various agents. The application consists of a React frontend and a Python FastAPI backend. Users can view a list of available agents, start and stop them, and see their log output in real-time. When an agent is running, a chat interface is provided to interact with it.

## Architecture

The application follows a client-server architecture.

### Frontend

The frontend is a single-page application built with **React** and **Vite**.

-   **`App.tsx`**: The main component that lays out the user interface into three main parts:
    -   An **Agent Sidebar** (`components/AgentSidebar.tsx`) to list agents and control them (start/stop).
    -   A **Chat Interface** (`components/ChatInterface.tsx`) to interact with a selected, running agent.
    -   An **Info Pane** (`components/InfoPane.tsx`) that displays real-time logs from the agents and the backend management server.
-   **`hooks/useManagementSocket.ts`**: This custom hook is the core of the frontend's real-time functionality. It connects to the backend's WebSocket and handles all communication.
    -   It maintains the state of the agents (e.g., `RUNNING`, `STOPPED`).
    -   It sends `start` and `stop` commands to the backend.
    -   It receives and processes `status` and `log` messages from the backend, updating the UI accordingly.
-   **`services/agentService.ts`**: This file contains the `runTurn` function, which makes a `POST` request to the agent's root URL (`/`) to send a prompt and receive a response.
-   **State Management**: The primary state (list of agents, logs) is managed within the `useManagementSocket` hook and passed down to the various components.

### Backend

The backend is a Python application built with **FastAPI**.

-   **`main.py`**: This file defines the entire backend server.
-   **WebSocket Communication**: The backend exposes a single WebSocket endpoint at `/ws`. This is the primary means of communication with the frontend.
    -   It listens for JSON commands from the client (e.g., `{"action": "start", "agent_name": "greeting_agent"}`).
    -   It broadcasts JSON messages to all connected clients to provide real-time updates on agent status and logs.
-   **Agent Management**: The backend is responsible for dynamically preparing and running the agents.
    -   When a "start" command is received, the backend performs the following steps:
        1.  **Virtual Environment Creation**: It checks for a `.venv` directory in the agent's folder (e.g., `agents/greeting_agent/.venv`). If it doesn't exist, it creates one using `python3 -m venv`.
        2.  **`uv` Installation**: It ensures the `uv` package manager is installed in the agent's virtual environment.
        3.  **Dependency Installation**: It uses `uv pip install -r requirements.txt` to install the agent's dependencies.
        4.  **Subprocess Execution**: It starts the agent as a **subprocess** using `asyncio.create_subprocess_exec` and the `adk api_server` command.
    -   It captures the `stdout` and `stderr` of the agent processes and streams them to the frontend as log messages.
    -   A dictionary `running_processes` keeps track of the active agent subprocesses.

## Agents

The agents are individual, runnable applications built with the `google-adk` library. Each agent resides in its own subdirectory within the `agents/` folder.

-   **`greeting_agent`**: A simple agent that provides a greeting.
-   **`weather_agent`**: An agent that likely provides weather information.

To be runnable by the backend, each agent needs two key files:

1.  **`requirements.txt`**: This file must list all the agent's Python dependencies, including `google-adk`.
2.  **`main.py`**: This file must define the agent and expose it as a `serving` object. The `serving` object is created by calling `serve.from_callable(agent.run_async)` from the `google.adk.runtime` library. This exposes the agent's core logic at the `/` endpoint, which the frontend's `runTurn` function expects.

*Note: The `weather_agent` is not yet implemented and its `main.py` file is empty.*

## Interacting with ADK Agents

When running an ADK agent programmatically using `google.adk.runners.Runner`, it is crucial to understand the data structures for sending input and parsing output.

### Sending User Input

The `runner.run_async()` method expects a `new_message` argument. This can be a `google.genai.types.Content` object. To send a simple text prompt, structure it as follows:

```python
from google.genai.types import Content, Part

prompt_text = "Hello"
message = Content(parts=[Part(text=prompt_text)])

response_generator = agent_runner.run_async(
    user_id=...,
    session_id=...,
    new_message=message
)
```

### Parsing Agent Responses

The `run_async()` method returns an asynchronous generator that yields `google.adk.core.events.Event` objects. The agent's textual response is nested within these events. To extract the complete response, you must iterate through the generator, access the `content` attribute of each event, and then iterate through the `parts` of that content.

```python
response_chunks = []
async for event in response_generator:
    if hasattr(event, 'content') and event.content.parts:
        for part in event.content.parts:
            if hasattr(part, 'text'):
                response_chunks.append(part.text)

response = "".join(response_chunks)
```

This ensures that you correctly extract the text from the `Part` objects and handle cases where a response might be split across multiple events or parts.

## Running ADK Agents Programmatically

It is important to note that `google.adk.runtime` does not exist. The correct way to run an ADK agent within a Python application is by using the `Runner` and `Session` objects from the `google.adk.runners` and `google.adk.sessions` modules respectively.

-   **`Session`**: Represents a stateful chat history between a user and one or more agents. It stores data that persists throughout the conversation.
-   **`Runner`**: Connects agents with sessions and manages the flow of information between them.

Here is an example of how to run an agent programmatically:

```python
from google.adk.runners import Runner
from google.adk.sessions import Session, InMemorySessionService
from google.adk.contrib.llms import Gemini
from google.adk.core import Inference, prompt, run_sync
from google.adk.core.events import TextData, UserInput

# Define your agent
@prompt.from_template("Hello! I am a friendly greeting agent. How can I help you today?")
def greeting_agent(request: Inference) -> Inference:
    return request.with_payload(
        {"output": f"Hello! I am a friendly greeting agent."}
    )

# Run the agent
session_service = InMemorySessionService()
runner = Runner(agent=greeting_agent, session_service=session_service)
response_generator = runner.run(
    user_id="test_user",
    session_id="test_session",
    new_message=UserInput(text="Hello")
)
response = "".join([chunk.text for chunk in response_generator if hasattr(chunk, 'text')])
print(response)

```

## How to Run

1.  **Start the Backend**:
    ```bash
    uvicorn backend.main:app --reload
    ```
2.  **Start the Frontend**:
    ```bash
    npm install
    npm run dev
    ```
3.  Open a web browser to the URL provided by Vite (usually `http://localhost:5173`).

## Testing

**IMPORTANT:** All testing MUST be executed manually, NOT through a Gemini CLI session. Gemini CLI must prompt the user to run tests, never run them itself.

To run the integration tests, use the following command:

```bash
.venv/bin/python -m pytest
```

**Note:** Ensure you have shut down any running backend servers before running the tests to avoid port conflicts.

## Development Workflow

When a test fails, the following workflow should be followed:
1. Fix the code to address the test failure.
2. Run the tests to ensure that the fix is effective.
3. Once the tests pass, commit the changes.
4. Do not use backticks (\`) in git commit messages.