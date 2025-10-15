# Agent Gallery

Agent Gallery provides a user interface for managing and interacting with multiple agents built with the Google Agent Development Kit (ADK). It allows developers to run, test, and debug agents in a realistic, isolated environment without needing to modify the agent's source code.

This application serves as a powerful alternative to the standard `adk web` command, offering several key advantages:

*   **Multi-Agent Management**: View, start, and stop multiple agents from a single, consolidated user interface.
*   **Real-Time Observability**: See live log streams from both the backend management server and each running agent, providing deep insight into execution.
*   **Interactive Chat**: Engage with any running agent through a dedicated chat window to test its conversational flow and tool usage.
*   **Zero-Code Integration**: Agents in the `agents/` directory are discovered and run as-is, with no modifications required.
*   **Isolated Environments**: The gallery automatically creates and manages a dedicated virtual environment for each agent, ensuring clean dependency management and preventing conflicts.
*   **Live Event Streaming**: The backend streams fine-grained tool call events (`before_tool_call`, `after_tool_call`) to the UI in real-time, allowing you to see exactly what the agent is doing as it happens.

## Architecture

The application follows a client-server model with a React frontend and a Python FastAPI backend. The new architecture is designed for stability and introspection, running each agent in an isolated subprocess.

### Frontend

The frontend is a single-page application built with **React** and **Vite**.

*   **UI Components**: The UI is divided into an `AgentSidebar` for managing agents, a `ChatInterface` for interacting with them, and an `InfoPane` that displays real-time logs and events.
*   **Real-time Functionality**: A custom hook, `useManagementSocket.ts`, connects to the backend's WebSocket to send control commands (start/stop) and receive live status updates, logs, and agent events.

### Backend

The backend is a Python application built with **FastAPI** that manages the agent lifecycle.

*   **`AgentRunner`**: This core class is responsible for a single agent. It creates a dedicated virtual environment, installs dependencies using `uv`, and launches the agent in an isolated subprocess.
*   **`agent_host.py`**: This script acts as a lightweight wrapper inside the agent's subprocess. It dynamically loads the agent's `serving` object and starts a `uvicorn` server, exposing the agent at a specific port.
*   **Event Streaming**: A custom ADK plugin (`EventStreamingPlugin`) is injected into the agent at runtime. It intercepts tool call events and writes them to a pipe. The `AgentRunner` reads from this pipe and broadcasts the events in real-time to the frontend via WebSocket, allowing for deep introspection without altering the agent's code.
*   **WebSocket API**: The primary `/ws` endpoint handles commands from the frontend and broadcasts status updates, logs, and agent events to all connected clients.

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

## Roadmap

This project is under active development. Future enhancements include:

*   **Multi-Session Support**: Enable multiple, concurrent conversations with a single running agent instance, allowing for isolated testing of different conversational paths.
*   **Agent-to-Agent (A2A) Communication**: Implement a transparent proxy to allow agents to call each other, enabling more complex, multi-agent workflows.
*   **Production Hardening**: Improve error handling, implement structured logging for easier debugging, and expand the test suite to cover all components.
