# EPIC: SSE Integration and Backend Simplification

- **Effort Assessment: EPIC**
- **Status: In Progress**

This document outlines the plan to refactor the Agent Gallery's backend architecture. The primary goal is to replace the complex, custom inter-process communication (IPC) mechanism with the native Server-Side Events (SSE) architecture provided by the Agent Development Kit (ADK). This will simplify the codebase, improve robustness, and align the project with standard ADK practices.

The critical feature of running each agent in its own process on a separate port **will be maintained**.

## Architecture

### Current Architecture Diagnosis

-   **Complex Process Management**: The main backend (`main.py`) launches a separate Python process for each agent using a set of `AgentRunner` classes.
-   **Bespoke IPC for Events**: A custom `EventStreamingPlugin` captures ADK events within the agent subprocess, serializes them to JSON, and writes them to an OS-level pipe. The `BaseAgentRunner` in the main process reads this pipe and forwards the events to the frontend via a management WebSocket.
-   **Redundant Web Servers**: Each agent subprocess runs its own `uvicorn` server with a custom WebSocket endpoint (`/ws/agent_events`) solely for streaming events back to the main backend.
-   **WebSocket Proxy**: The main backend acts as a WebSocket proxy, receiving control commands from the frontend and relaying agent events, adding a layer of complexity.

### Proposed Architecture

The refactored architecture will simplify communication by allowing the frontend to communicate directly with each agent's standardized ADK server.

1.  **Process Management (`main.py`)**: The main backend will retain its role as a process and lifecycle manager. It will continue to:
    -   Read `gallery.config.yaml` to discover agents from the configured `agent_roots`.
    -   Serve the `/agents` REST endpoint.
    -   Manage a central WebSocket (`/ws`) for control and status updates.
    -   Launch each agent in a separate subprocess on a unique port.
    -   When an agent is running, it will broadcast a `status` message containing the agent's direct URL (e.g., `http://localhost:8001`) to the frontend.

2.  **Agent Server (`agent_server.py`)**: This script will be heavily simplified. Its sole responsibility will be to:
    -   Load the specified agent module.
    -   Create a standard ADK `Runner`.
    -   Use `google.adk.runtime.serve.from_runner` to create and run a FastAPI application.
    -   This will automatically expose the native ADK endpoints that the frontend will use:
        -   **REST Endpoint (`/run`)**: For sending user prompts and running turns.
        -   **SSE Endpoint (`/chat/stream`)**: For receiving the real-time stream of ADK events.

3.  **Frontend Communication Flow**:
    -   **Control**: The frontend maintains its existing WebSocket connection to `main.py` to receive the list of agents and their status (including the direct URL when an agent is running).
    -   **Chat**: When a user interacts with a running agent, the frontend will now communicate **directly** with that agent's URL:
        -   It will send the user's prompt via a `POST` request to the agent's `/run` endpoint.
        -   It will establish an `EventSource` connection to the agent's `/chat/stream` SSE endpoint to receive the live event stream.

## Implementation Plan

### Phase 1: Backend - Introduce SSE and HTTP Endpoints (Non-Breaking)

**Goal:** Introduce a new SSE endpoint for event streaming and HTTP endpoints for agent control. This will be done in parallel with the existing WebSocket implementation to allow for a gradual migration and prevent breaking the current frontend.

1.  **Introduce a Centralized Broadcaster**
    *   **File:** `backend/main.py`
    *   **Modification:** Create a `Broadcaster` class to manage multiple client message queues. This decouples event generation from the communication protocol (WebSocket/SSE).
    *   **Details:**
        *   The class will hold a list of `asyncio.Queue` instances.
        *   `register(queue)`: Adds a client queue to the list.
        *   `unregister(queue)`: Removes a client queue.
        *   `broadcast(message)`: Puts a JSON-serialized message into all registered queues.
    *   **Testability:** The `Broadcaster` can be unit-tested independently.

2.  **Integrate Broadcaster into Agent Management**
    *   **File:** `backend/main.py`
    *   **Modification:** Refactor `start_agent_proc`, `stop_agent_proc`, and the log streaming logic to push all status and log messages to the central `Broadcaster` instead of the WebSocket `ConnectionManager`.
    *   **Testability:** Verify that agent actions result in the correct messages being added to the broadcaster's queues.

3.  **Adapt WebSocket to Use the Broadcaster**
    *   **File:** `backend/main.py`
    *   **Modification:** Update the existing `/ws` endpoint to ensure continued functionality.
    *   **Details:**
        *   On connection, a client will register a new queue with the `Broadcaster`.
        *   The WebSocket connection will run two concurrent tasks:
            1.  Listen for incoming control messages from the client (e.g., `start`, `stop`).
            2.  Listen for outgoing messages from its registered queue and send them to the client.
        *   On disconnect, the queue is unregistered.
    *   **Testability:** The frontend should function exactly as before, with no observable changes.

4.  **Add New HTTP Endpoints for Agent Control**
    *   **File:** `backend/main.py`
    *   **Modification:** Create new RESTful endpoints for agent lifecycle management.
    *   **Endpoints:**
        *   `GET /api/agents`: Returns a list of all available agents and their current status (`RUNNING` or `STOPPED`).
        *   `POST /api/agents/{agent_name}/start`: Starts the specified agent. Returns a success/failure message.
        *   `POST /api/agents/{agent_name}/stop`: Stops the specified agent. Returns a success/failure message.
    *   **Testability:** These endpoints can be tested directly using an HTTP client like `curl` or `pytest`.

5.  **Add SSE Endpoint for Event Streaming**
    *   **File:** `backend/main.py`
    *   **Dependency:** Add `sse-starlette` to `backend/requirements.txt`.
    *   **Modification:** Create a new `/sse` endpoint using `sse_starlette.EventSourceResponse`.
    *   **Details:**
        *   On connection, the endpoint will register a new queue with the `Broadcaster`.
        *   It will then loop indefinitely, pulling messages from its queue and yielding them to the client in SSE format (`data: <json_message>\n\n`).
        *   The request handling will be wrapped in a `try/finally` block to ensure the queue is unregistered on client disconnect.
    *   **Testability:** The endpoint can be tested with `curl` or a client library to verify the event stream.

### Phase 2: Frontend Integration

1.  **Update Session Management**:
    -   **Action:** Review `frontend/services/sessionManager.ts` and `frontend/services/baseSession.ts`.
    -   **Action:** The current implementation already appears to use `EventSource` and direct `POST` requests to the agent's URL. This phase will involve verifying that this implementation is fully compatible with the new standardized ADK server endpoints and making any minor adjustments required.
    -   **Action:** The logic in `useManagementSocket.ts` that handles the proxied `agent_event` messages will be removed. The event display in `InfoPane.tsx` will now be driven by the direct SSE connection managed within the `ChatInterface`.
    -   **Outcome:** The frontend is fully migrated to communicate directly with the agent subprocesses for all chat-related interactions.

## Effort Assessment

-   **Backend:** High. Involves touching multiple core files and fundamentally changing the communication logic.
-   **Frontend:** Low to Medium. The frontend is already well-architected for this change, but verification and removal of old logic is required.
-   **Overall:** This is an **EPIC** due to the significant architectural changes in the backend, even though the frontend impact is smaller. It simplifies the system dramatically, reducing complexity and improving maintainability.
