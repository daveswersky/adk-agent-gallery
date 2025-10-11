### **Implementation Plan: Phased Rollout**

This document provides a phased implementation plan for the architecture described in the [Architectural Design](./programmatic_agent_runner_design.md).

This plan breaks the work into four distinct, sequential phases. Each phase delivers a testable piece of functionality, allowing for iterative development and reducing risk.

---

### **Phase 1: Backend Refactoring (In Progress)**

**Overall Goal:** Incrementally replace the agent process management on the backend without altering the WebSocket API contract, ensuring the UI remains fully functional throughout.

**Current Status (Phase 1b):** The `agent_host.py` script and its corresponding integration test (`test_agent_host.py`) have been implemented. However, the test is currently **failing** with a `500 Internal Server Error`.

*   **Progress:** Several initial setup and integration issues have been resolved, including dependency installation, dynamic `app_name` configuration, `Session` initialization, and setting the required `GOOGLE_API_KEY` environment variable. The agent host process now starts successfully.
*   **Next Step:** The `run_turn` function in `agent_host.py` is throwing an unhandled exception, resulting in the 500 error. Diagnostic logging has been added to this function. The immediate next step is to run the test again to capture the specific exception and resolve the final issue in this phase.

---

#### **Phase 1a: Introduce `AgentRunner` as a Wrapper**

**Goal:** Refactor the existing process management logic into a new `AgentRunner` class without changing its behavior. This is a pure refactoring step to establish the new class structure.

1.  **Create `AgentRunner` Class:**
    *   Create a new file, `backend/agent_runner.py`, with a skeleton `AgentRunner` class.
2.  **Refactor Process Management:**
    *   In `main.py`, move the existing `asyncio.create_subprocess_exec` logic (which runs `adk api_server`) into a new `AgentRunner.start()` method.
    *   The `AgentRunner` instance will store the `Process` object and its `stdout`/`stderr` streams.
    *   Create an `AgentRunner.stop()` method to terminate the stored process.
3.  **Integrate `AgentRunner` into `main.py`:**
    *   Update the WebSocket "start" command handler in `main.py` to create an `AgentRunner` instance.
    *   The log streaming loop in `main.py` should now read from the stream objects managed by the `AgentRunner`.
    *   The `run_turn` logic in `main.py` (which sends an HTTP request to the `adk api_server` port) will remain unchanged for now.

**Testing:** The application should be manually testable and function identically to its current state. Starting, stopping, and interacting with an agent via the UI should show no change in behavior.

---

#### **Phase 1b: Develop and Test `agent_host.py` in Isolation**

**Goal:** Create the new agent hosting script and verify its correctness independently of the main application.

1.  **Create `agent_host.py`:**
    *   Build the script as a minimal FastAPI application that loads and runs an agent based on command-line arguments (`--agent-path`, `--port`).
2.  **Create Host Dependencies:**
    *   Create `backend/agent_host_requirements.txt` containing `fastapi` and `uvicorn`.
3.  **Write Integration Test:**
    *   Create a new test file, `backend/tests/test_agent_host.py`.
    *   This test will use Python's `subprocess` module to run `agent_host.py` with a sample agent (e.g., `greeting_agent`).
    *   It will then use an HTTP client like `httpx` to send a `POST` request to the running host and assert that the agent's response is correct.

**Testing:** Run `pytest backend/tests/test_agent_host.py`. The test should pass, proving the new hosting mechanism works as expected before it's integrated.

---

#### **Phase 1c: Integrate `agent_host.py` into `AgentRunner`**

**Goal:** Switch the `AgentRunner` to use the new, validated `agent_host.py` script instead of the original `adk api_server` command.

1.  **Update `AgentRunner` Dependencies:**
    *   Modify `AgentRunner.__init__` to perform the two-step dependency installation: first the agent's `requirements.txt`, then the host's `agent_host_requirements.txt`.
2.  **Update `AgentRunner.start` Method:**
    *   Change the command in `AgentRunner.start()` to execute `python3 backend/agent_host.py` with the correct arguments. It must continue to capture `stdout` and `stderr` for log streaming.
3.  **Create `AgentRunner.run_turn` Method:**
    *   Implement a new `run_turn` method inside `AgentRunner`. This method will use `httpx` to send the user's prompt to the `agent_host`'s `/` endpoint.
4.  **Update `main.py`:**
    *   Modify the `run_turn` handler in `main.py` to call the new `agent_runner.run_turn()` method instead of sending its own HTTP request.

**Testing:** Once again, the application should be fully functional from the UI. This change should be transparent to the end-user, but the backend will now be using the new, more robust agent hosting mechanism.

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
