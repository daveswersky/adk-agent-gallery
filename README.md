# Agent Gallery

This project is a web-based Agent Gallery that allows users to manage and interact with various agents based on the Agent Development Kit. The application consists of a React frontend and a Python FastAPI backend. Users can view a list of available agents, start and stop them, and see their log output in real-time. When an agent is running, a chat interface is provided to interact with it.

## Architecture

The application follows a client-server architecture.

### Frontend

The frontend is a single-page application built with **React** and **Vite**.

-   **Real-time Functionality**: A custom hook, `useManagementSocket.ts`, connects to the backend's WebSocket to send commands (start/stop agents) and receive real-time status and log updates.
-   **Chat Interface**: When an agent is running, a chat interface allows users to send prompts and view responses from the agent. The `agentService.ts` handles the communication with the agent's API endpoint.

### Backend

The backend is a Python application built with **FastAPI**.

-   **WebSocket Communication**: The backend exposes a single WebSocket endpoint at `/ws` for real-time communication with the frontend.
-   **Dynamic Agent Management**: The backend is responsible for dynamically preparing and running the agents. When a "start" command is received, it:
    1.  Creates a virtual environment for the agent if one doesn't exist.
    2.  Installs the `uv` package manager.
    3.  Installs the agent's dependencies from `requirements.txt`.
    4.  Starts the agent as a subprocess using the `adk api_server` command.
-   **Log Streaming**: It captures the `stdout` and `stderr` of the agent processes and streams them to the frontend as log messages.

## Agents

The agents are individual, runnable applications built with the `google-adk` library. Each agent resides in its own subdirectory within the `agents/` folder.

To be runnable by the backend, each agent needs:

1.  **`requirements.txt`**: This file must list all the agent's Python dependencies, including `google-adk`.
2.  **`main.py`**: This file must define the agent and expose it as a `serving` object using `serve.from_callable(agent.run_async)` from the `google.adk.runtime` library.

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