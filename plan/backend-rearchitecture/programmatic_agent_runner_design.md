### **Architectural Design: Programmatic Agent Runner with Event Streaming**

This document outlines a new, robust backend architecture for the Agent Gallery. The goal is to enable fine-grained, real-time event tracking while ensuring process isolation, stability, and environment parity.

_For a step-by-step guide, see the [Implementation Plan](./backend_rearchitecture_implementation_plan.md)._
---

#### **1. Core Concepts & Goals**

The architecture is a hybrid model that runs each agent in a sandboxed subprocess, managed by a central `AgentRunner`. This provides deep introspection into the agent's lifecycle without compromising the stability of the backend or other agents.

This design will:

*   **Embrace a "Host-Provided UI" Model**: The Agent Gallery application will function as a "host" for imported agents. It provides the user interface, lifecycle management, and orchestration, while the agents run in isolated environments, identical to how they would run in a production setting. This ensures that agents under the `/agents` folder can be imported and executed "as-is," with no modifications required to their internal code or dependencies.
*   **Maintain strict dependency isolation** using per-agent virtual environments.
*   Run each agent in its own subprocess, managed by the main backend.
*   Use a custom `google-adk` **plugin** and a **`multiprocessing.Queue`** for reliable, inter-process event communication.
*   Guarantee the correct order of events and final responses broadcast to the frontend.
*   Provide transparent Agent-to-Agent (A2A) communication that mirrors a production environment.

---

#### **2. Proposed Components**

**A. New Module: `backend/agent_runner.py`**

This module contains the `AgentRunner` class, which acts as a process manager and synchronized client for a single agent.

*   **`AgentRunner` Class**:
    *   **`__init__(self, agent_name: str, agent_path: str, event_callback: Callable)`**:
        *   Manages the agent's virtual environment. It performs a two-step dependency installation to enforce strict separation between the host's environment and the agent's environment:
            1.  **Agent Dependencies**: First, it installs the agent's own, unmodified dependencies from its local `requirements.txt`.
            2.  **Host Dependencies**: Second, it installs the gallery's hosting dependencies (e.g., `fastapi`, `uvicorn`) from a central `backend/agent_host_requirements.txt`. These are necessary for the gallery to manage the agent process but are kept isolated from the agent's core dependencies.
        *   Creates a **`multiprocessing.Queue`** for receiving events from the agent subprocess.
        *   Starts the agent by executing the `agent_host.py` script in the fully prepared subprocess, passing necessary arguments (agent path, port, queue identifier).
        *   Monitors the health of the subprocess.
    *   **`async def run_turn(self, prompt: str, user_id: str, session_id: str)`**:
        *   Starts a concurrent task to read from the event queue and broadcast events using the `event_callback`.
        *   Makes an HTTP `POST` request to the agent's `localhost:[port]` endpoint.
        *   Waits for the HTTP response. Upon receiving it, continues to drain the event queue until it is empty.
        *   Returns the final result only after the HTTP response is received and the event queue is fully drained.
    *   **`stop(self)`**: Gracefully terminates the agent's subprocess.

**B. New Module: `backend/agent_host.py` (Agent Subprocess Entrypoint)**

This script is the bridge between the `AgentRunner` and the agent's code. It runs as a self-contained web server within the agent's sandboxed environment.

*   **Responsibilities**:
    1.  Parses command-line arguments: agent path and port.
    2.  Initializes a **FastAPI** application.
    3.  Dynamically imports the `root_agent` object from the specified path.
    4.  Creates a single, persistent `google.adk.sessions.Session` instance to maintain conversation history.
    5.  Defines a `POST /` endpoint that receives the user's prompt.
    6.  Inside the endpoint, it calls `google.adk.runners.Runner.run()` with the loaded agent and the persistent session.
    7.  Starts the `uvicorn` server to serve the FastAPI application.

**C. New Module: `backend/event_streaming_plugin.py`**

*   **`EventStreamingPlugin(BasePlugin)` Class**:
    *   **`__init__(self, event_queue: multiprocessing.Queue)`**: Stores a reference to the inter-process queue.
    *   Implements `google-adk` plugin callbacks (e.g., `before_tool_callback`).
    *   Inside each callback, it formats a structured JSON event and **puts it onto the `multiprocessing.Queue`**.

**D. Refactoring `backend/main.py`**

*   **Agent Management**: The `running_agents` dictionary will store `AgentRunner` instances.
*   **Embedded Proxy**: Will run a lightweight HTTP proxy server as a background task for A2A communication.
*   **WebSocket Endpoint (`/ws`)**: Manages the lifecycle of `AgentRunner` instances based on frontend commands.

---

#### **3. Synchronized Event Flow**

This flow guarantees correct ordering and eliminates race conditions.

1.  The `AgentRunner` is started. It creates an event queue and launches the `agent_host.py` subprocess.
2.  The `agent_host.py` process starts the agent's web server and connects its `EventStreamingPlugin` to the queue.
3.  A `run_turn` request is received. The `AgentRunner` starts its queue-reading task and makes an HTTP request to the agent.
4.  As the agent executes, the plugin intercepts events and puts them on the queue.
5.  The `AgentRunner`'s task reads events from the queue and broadcasts them to the frontend in real-time.
6.  The agent finishes and returns an HTTP response.
7.  The `AgentRunner` receives the response, waits for the event queue to be empty, and then returns the final response.

---

#### **4. Error Handling and Health Monitoring**

The `AgentRunner` is responsible for the resilience of the system.

*   **Process Health**: The `AgentRunner` will monitor its subprocess. If the process terminates unexpectedly, it will send a "crash" event to the frontend and clean up its resources.
*   **Error Propagation**: If the agent's HTTP server returns a non-200 status code, the `AgentRunner` will capture the error and send a structured error event to the frontend.
*   **Startup Failures**: Any errors during agent startup (e.g., missing dependencies, code errors) will be captured from the subprocess's `stderr` and reported to the frontend.

---

#### **5. Agent-to-Agent (A2A) Communication**

*   **Core Principle**: Agents use the standard `google.adk.a2a.RemoteA2aAgent`.
*   **Architecture: Embedded Proxy**:
    1.  The main backend runs a lightweight HTTP proxy.
    2.  The `AgentRunner` injects `HTTP_PROXY` environment variables into the agent subprocess, pointing to this proxy.
    3.  The proxy intelligently routes requests: internal agent requests are forwarded to the correct `localhost:[port]`, while external requests are passed through to the internet.

---

#### **6. Future Considerations**

*   **Resource Management**: The current design has a 1:1 resource cost (process, port) per running agent. A future enhancement could be a resource manager that limits the number of concurrent agents or shuts down idle agents to conserve system resources.
*   **Security**: The `agent_host.py` script should include security hardening, such as validating the agent path to prevent directory traversal and ensuring it only loads code from within the designated `agents` directory.
