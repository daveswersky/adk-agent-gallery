### **Implementation Plan: Phased Rollout**

This plan breaks the work into four distinct, sequential phases. Each phase delivers a testable piece of functionality, allowing for iterative development and reducing risk.

---

#### **Phase 1: Core Process Management**

**Goal:** Replace the current `adk api_server` subprocess with the new `AgentRunner` that manages a `uvicorn` subprocess. Event streaming is **not** implemented in this phase.

1.  **Create `agent_host.py`:**
    *   Build the basic script that takes an agent path and port.
    *   It should dynamically import the agent's `serving` object and start a `uvicorn` server.
2.  **Create `AgentRunner` Class:**
    *   Implement the `__init__` method to manage the `.venv` and start the `agent_host.py` script as a subprocess.
    *   Implement the `stop` method to terminate the process.
3.  **Implement `AgentRunner.run_turn` (HTTP Client):**
    *   Implement the method to simply make an HTTP POST request to the agent's `localhost:[port]`. It should not yet handle any event queueing.
4.  **Update `main.py`:**
    *   Replace the existing `asyncio.create_subprocess_exec` logic with the new `AgentRunner`.
    *   Wire up the `start`, `stop`, and `run_turn` actions from the WebSocket to the `AgentRunner` instance.

**Outcome:** The application should function exactly as it does now, but with the new process management backend. This is a critical refactoring step that can be tested in isolation.

---

#### **Phase 2: Event Streaming**

**Goal:** Implement the real-time event streaming from the agent to the frontend.

1.  **Create `EventStreamingPlugin`:**
    *   Create the new plugin class.
    *   It should take a `multiprocessing.Queue` in its constructor.
    *   Implement the `before_tool_callback` and `after_tool_callback` methods to format a JSON event and `put()` it on the queue.
2.  **Integrate IPC:**
    *   Update `AgentRunner` to create a `multiprocessing.Queue` and pass its identifier to the `agent_host.py` subprocess.
    *   Update `agent_host.py` to connect to this queue and pass it to the `EventStreamingPlugin`.
3.  **Implement Synchronized `run_turn`:**
    *   Update `AgentRunner.run_turn` with the full logic: start the queue-reader task, await the HTTP response, and then drain the queue before returning.
4.  **Update Frontend (If Necessary):**
    *   Ensure the frontend can correctly parse and display the new structured event types (`before_tool`, `after_tool`).

**Outcome:** The Info Pane in the UI will now show real-time events as the agent executes its tools.

---

#### **Phase 3: Agent-to-Agent (A2A) Communication**

**Goal:** Enable agents to communicate with each other transparently.

1.  **Implement Embedded Proxy:**
    *   Add a lightweight proxy server (e.g., using `httpx-proxy`) to `main.py` and run it as a background task.
    *   Implement the routing logic to check the service registry and forward requests.
2.  **Inject Proxy Settings:**
    *   Update `AgentRunner` to set the `HTTP_PROXY` and `HTTPS_PROXY` environment variables when it creates the agent subprocess.
3.  **Create a Test Agent:**
    *   Create a new agent that is designed to call another (e.g., a "travel_planner" agent that calls the `weather_agent`).
    *   Configure it to use the `google.adk.a2a.RemoteA2aAgent` pointing to the internal URL (`http://agent.gallery.internal/weather_agent`).

**Outcome:** We can now run multiple agents that successfully collaborate to complete a task.

---

#### **Phase 4: Hardening and Finalization**

**Goal:** Make the new system robust, resilient, and production-ready.

1.  **Implement Error Handling:**
    *   Implement the full error handling and health monitoring strategy in the `AgentRunner` as specified in the design.
    *   Ensure the frontend displays crashes and errors gracefully.
2.  **Add Comprehensive Logging:**
    *   Add structured logging to all new components (`AgentRunner`, `agent_host`, proxy) to make debugging easier.
3.  **Write Tests:**
    *   Write unit tests for the `AgentRunner` and the `EventStreamingPlugin`.
    *   Write integration tests that start a real agent subprocess and verify the event flow and A2A communication.

**Outcome:** The new architecture is stable, reliable, and ready for use.
