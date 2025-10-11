### Phase 1 Testing Plan

**Objective:** Verify that the new `AgentRunner` backend correctly manages the lifecycle of agents, provides clear and immediate feedback during the startup process, and maintains the same core functionality as the previous implementation.

---

#### **Test Case 1: Successful Agent Lifecycle**

*   **Description:** Tests the "happy path" for a correctly configured agent from start to stop.
*   **Steps:**
    1.  Start the backend and frontend servers.
    2.  In the UI, click "Start" on the `greeting_agent`.
    3.  **Observe & Verify:** The log pane must show real-time output for venv creation, `uv` installation (if needed), and requirements installation, followed by the `uvicorn` server logs. The agent's status must change to "RUNNING".
    4.  Select the running agent and send a "Hello" prompt in the chat interface.
    5.  **Verify:** The agent returns a valid greeting response.
    6.  Click the "Stop" button.
    7.  **Verify:** The agent's status changes to "STOPPED" and its logs indicate termination.

---

#### **Test Case 2: Startup Failure - Invalid `requirements.txt`**

*   **Description:** Tests the system's ability to gracefully handle an error during the dependency installation phase.
*   **Steps:**
    1.  Modify `agents/greeting_agent/requirements.txt` to include a non-existent package (e.g., `no-such-package-exists-12345`).
    2.  Start the `greeting_agent`.
    3.  **Observe & Verify:** The log pane must show the `uv pip install` command output, which should clearly display an error that the package was not found.
    4.  **Verify:** The agent's status must immediately change to "FAILED".
*   **Cleanup:** Restore the `requirements.txt` file to its original state.

---

#### **Test Case 3: Startup Failure - Syntax Error in Agent Code**

*   **Description:** Tests the system's ability to handle a Python error within the agent's own code, which prevents the `uvicorn` server from starting.
*   **Steps:**
    1.  Modify `agents/greeting_agent/greeting_agent/agent.py` to introduce a Python syntax error (e.g., an unclosed parenthesis).
    2.  Start the `greeting_agent`.
    3.  **Observe & Verify:** The log pane must show the dependency installation completing successfully, followed by a Python `SyntaxError` traceback originating from the `agent_host.py` script's attempt to import the agent.
    4.  **Verify:** The agent's status must change to "FAILED".
*   **Cleanup:** Correct the syntax error in the `agent.py` file.

---

#### **Test Case 4: Concurrency and Graceful Shutdown**

*   **Description:** Tests the system's ability to run multiple agents concurrently and shut down cleanly.
*   **Steps:**
    1.  Start the `greeting_agent` and verify it is running.
    2.  Start the `weather_agent` and verify it is running concurrently.
    3.  Interact with both agents to ensure they operate independently.
    4.  Stop the main backend server process (e.g., using `Ctrl+C`).
    5.  **Observe & Verify:** The backend server's console output must show logs indicating it is stopping each running agent.
    6.  Confirm that the `agent_host.py` subprocesses for both agents have been terminated.
