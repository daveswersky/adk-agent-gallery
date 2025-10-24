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

The application follows a client-server model with a React frontend and a Python FastAPI backend. Agents are discovered from the `agents/` directory and run in isolated subprocesses, with their own virtual environments and dependencies managed automatically by the backend.

For a comprehensive overview of the architecture, please see the [ARCHITECTURE.md](ARCHITECTURE.md) file.

### Frontend

The frontend is a single-page application built with **React** and **Vite**. It uses a WebSocket to communicate with the backend for real-time updates, allowing users to manage agents and interact with them through a chat interface.

### Backend

The backend is a Python application built with **FastAPI**. It manages the agent lifecycle, including creating virtual environments, installing dependencies, and running agents as isolated subprocesses. It uses a WebSocket to send agent status, logs, and events to the frontend.

## How to Run

### Prerequisites

After cloning the repository, initialize and update the submodules:

```bash
git submodule update --init --recursive
```

### Backend Setup

1.  **Configure the Gallery**: Rename `example.gallery.config.yaml` to `gallery.config.yaml`.
    ```bash
    mv example.gallery.config.yaml gallery.config.yaml
    ```
2.  **Set up your API Key**: Create a file named `.env` in the project root and add your Gemini API key to it:
    ```
    GEMINI_API_KEY="YOUR_API_KEY"
    ```
3.  **Create a Virtual Environment**: From the project root, create a Python virtual environment.
    ```bash
    python3 -m venv .venv
    ```
4.  **Activate the Environment**:
    *   On macOS and Linux:
        ```bash
        source .venv/bin/activate
        ```
    *   On Windows:
        ```bash
        .venv\Scripts\activate
        ```
5.  **Install Dependencies**:
    ```bash
    pip install -r backend/requirements.txt
    ```
6.  **Run the Backend Server**:
    ```bash
    uvicorn backend.main:app --reload
    ```

### Frontend Setup

1.  **Navigate to Frontend Directory**: In a separate terminal, from the project root, run:
    ```bash
    cd frontend
    ```
2.  **Install Dependencies**:
    ```bash
    npm install
    ```
3.  **Run the Frontend Dev Server**:
    ```bash
    npm run dev
    ```

After completing these steps, open a web browser to the URL provided by Vite (usually `http://localhost:5173`).

**Note for Gemini CLI Users:**

If you are using the Gemini CLI to follow these setup instructions, please run the backend and frontend servers in separate, dedicated terminals as the final step. Do not attempt to run them as background or foreground processes within the Gemini CLI itself.

## Roadmap

This project is under active development. Future enhancements include:

*   **Multi-Session Support**: Enable multiple, concurrent conversations with a single running agent instance, allowing for isolated testing of different conversational paths.
*   **Agent-to-Agent (A2A) Communication**: Implement a transparent proxy to allow agents to call each other, enabling more complex, multi-agent workflows.
*   **Production Hardening**: Improve error handling, implement structured logging for easier debugging, and expand the test suite to cover all components.
