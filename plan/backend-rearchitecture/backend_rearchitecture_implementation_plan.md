### **Implementation Plan: Phased Rollout**

This plan breaks the work into four distinct, sequential phases. Each phase delivers a testable piece of functionality, allowing for iterative development and reducing risk.

---

#### **Phase 1: Core Process Management**

**Status: Complete** (Regression test suite implemented and validated)

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

**Status: Complete** (Pipe-based IPC mechanism and unit tests for the `EventStreamingPlugin` have been implemented and validated.)

**Goal:** Implement the real-time event streaming from the agent to the frontend.

1.  **Create `EventStreamingPlugin`:**
    *   Create the new plugin class.
    *   It should take a file-like writer object (the write-end of a pipe) in its constructor.
    *   Implement the `before_tool_callback` and `after_tool_callback` methods to format a JSON event and write it to the pipe.
2.  **Integrate IPC via `os.pipe()`:**
    *   Update `AgentRunner` to create a pipe using `os.pipe()`.
    *   Pass the file descriptor for the write-end of the pipe to the `agent_host.py` subprocess.
    *   Update `agent_host.py` to accept the file descriptor, create a writer object from it, and pass that to the `EventStreamingPlugin`.
3.  **Implement Real-Time Event Broadcasting:**
    *   In `AgentRunner`, connect the read-end of the pipe to a custom `asyncio.Protocol` (`EventStreamProtocol`).
    *   This protocol reads newline-delimited JSON events from the pipe as they arrive.
    *   Each event is immediately broadcast to the frontend via the WebSocket `ConnectionManager`, ensuring real-time streaming without waiting for the turn to complete.
4.  **Update Frontend (If Necessary):**
    *   Ensure the frontend can correctly parse and display the new structured event types (`before_tool`, `after_tool`).

**Outcome:** The Info Pane in the UI will now show real-time events as the agent executes its tools.

**Progress Notes:**
*   **Shutdown Stability:** Resolved a critical bug in `main.py` that caused an `AttributeError` during server shutdown or hot-reloading. The shutdown hook was attempting to call `.stop()` on a dictionary instead of the `AgentRunner` instance and was not resilient to race conditions. The fix correctly accesses the nested runner object and adds type checking.
*   **Test Stabilization:** The unit tests for the `EventStreamingPlugin` have been completely rewritten and stabilized. The suite was updated from `unittest` to `pytest`, converted to `async`, and corrected to use the proper method signatures for ADK's `AgentTool`, resolving multiple `TypeError` exceptions. This fully validates the event streaming mechanism.

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

---

### **Future Enhancements (Post-MVP)**

*   **Multi-Session Support**: The current implementation uses a single, persistent session per agent. A future enhancement will be to manage multiple concurrent sessions, allowing for isolated conversations. This will require state management changes on both the frontend (to track which session is active in the UI) and the backend (to map incoming requests to the correct session object).
*   **Resource Management**: Add controls to limit the number of concurrently running agents and automatically shut down idle ones to conserve system resources.
*   **Enhanced Security**: Implement security best practices, such as validating agent paths to prevent directory traversal and sandboxing agent code execution.
