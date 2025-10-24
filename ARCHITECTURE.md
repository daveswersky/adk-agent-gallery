# Agent Gallery Architecture

The application follows a client-server architecture.

## Frontend

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

## Backend

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

The Agent Gallery is designed to run a variety of agents with minimal configuration. This is achieved through a flexible agent discovery mechanism and a "host-provided runtime" that adapts to different agent structures.

### Agent Integration and Discovery

Agents are discovered from multiple locations, which are defined in `gallery.config.yaml`. This allows for a clean separation between the gallery's core code and the agents it runs.

The primary sources for agents are:
1.  **Local Agents**: These are agents developed directly within the `agents/` directory of the gallery project. They serve as first-party examples and templates.
2.  **ADK Samples (Git Submodule)**: The official Google ADK Python samples are included as a Git submodule in `agents/adk-samples`. The gallery is pre-configured to discover and run these agents, providing a rich set of out-of-the-box examples.
3.  **A2A Samples (Git Submodule)**: The Agent-to-Agent (A2A) communication samples are also included as a submodule in `agents/a2a-samples`. These demonstrate more complex, multi-agent workflows.

By using Git submodules, the gallery can provide access to a wide range of official samples that can be updated independently of the gallery itself.

### Host-Provided Runtime

A core architectural goal is to run agents with **minimal to no modification**. The gallery achieves this by providing a "host-provided runtime." When the backend starts an agent, it doesn't just run a command; it injects a small amount of hosting logic. This logic is responsible for:
-   **Environment Setup**: Creating an isolated virtual environment for the agent.
-   **Dependency Installation**: Installing the agent's specific dependencies from its `requirements.txt` or `pyproject.toml`.
-   **Server Bootstrapping**: Dynamically loading the agent's `serving` object and starting a `uvicorn` server to expose it.
-   **Observability**: Capturing the agent's `stdout` and `stderr` and streaming them back to the frontend as logs.

This approach means that agent developers can focus on writing their agent's logic without worrying about the boilerplate of creating a web server or managing its process. As long as the agent adheres to the expected conventions (like exposing a `serving` object), the gallery can run it.

### Agent Configuration (`gallery.config.yaml`)

While the gallery aims for zero-config where possible, some agents require specific settings. The `gallery.config.yaml` file provides a centralized place to manage this.

-   **`agent_roots`**: This section defines the directories where the gallery should look for agents. Each entry has a `name` for display in the UI and a `path`. This is how the local, ADK, and A2A samples are all discovered.
-   **`agent_configs`**: This section allows for overriding the default behavior for specific agents. For example, A2A agents often use a `pyproject.toml` for dependency management instead of `requirements.txt`. This section allows the gallery to specify the correct dependency file and entrypoint for these agents.
-   **`agents` (Environment Variables)**: This section allows for setting agent-specific environment variables. This is useful for agents that require specific configuration, such as GCP project IDs or locations for Vertex AI services, without hardcoding them into the agent's source.
