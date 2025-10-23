# Epic: A2A Support - Phase 1 Implementation Plan (Backend Rearchitecture)

**Summary:** The foundational step for enabling Agent-to-Agent (A2A) communication is to re-architect the backend to support running self-contained, "self-hosted" agents (like the A2A samples) alongside the existing "raw" ADK agents.

This plan details the implementation of a **Dual-Runner Architecture** where the host remains responsible for the full lifecycle of all agents, ensuring a consistent and centralized management model.

**Reference Agent:** The `dice_agent_rest` agent located in `agents/a2a-samples/samples/python/agents/` will be used as the primary test case for the "a2a" agent type. The `greeting_agent` will be used to ensure the existing "adk" agent type remains functional.

---

## Implementation Steps

### Phase 1: Configuration and Agent Discovery

This phase focuses on updating the backend to understand the two different agent types based on a centralized configuration file.

-   **Step 1.1: Enhance `gallery.config.yaml`**
    -   **Action:** Introduce a new top-level section named `agent_configs`. This section will be a dictionary where keys are the full agent ID (e.g., `agents/a2a-samples/samples/python/agents/dice_agent_rest`) and values are objects specifying the agent's runtime configuration.
    -   **Schema:** The configuration object will have the following keys:
        -   `type`: (string, required) e.g., `"a2a"`
        -   `dependencies`: (string, required) The dependency file to use, e.g., `"pyproject.toml"` or `"requirements.txt"`
        -   `entrypoint`: (string, required) The script to execute, e.g., `"__main__.py"`
    -   **Default:** Any agent *not* found in `agent_configs` will be treated as `type: "adk"` with `dependencies: "requirements.txt"`.

-   **Step 1.2: Update Backend Configuration Loading**
    -   **File:** `backend/main.py`
    -   **Action:** Modify the server startup logic to read the `gallery.config.yaml` and parse the new `agent_configs` section into an in-memory dictionary. This dictionary will be used to look up agent configurations.

-   **Step 1.3: Create Agent Configuration Data Structure**
    -   **File:** `backend/main.py` (or a new `backend/config.py`)
    -   **Action:** Define a Pydantic model or a simple data class to represent the merged configuration for an agent (its ID, type, dependencies file, and entrypoint). The loading logic from Step 1.2 will populate these models, applying defaults for any agent not explicitly configured.

-   **Testing for Phase 1:**
    -   **Action:** Create a unit test that loads a sample `gallery.config.yaml`.
    -   **Verify:**
        -   The test should assert that the configuration for `dice_agent_rest` is correctly loaded with `type: "a2a"`.
        -   The test should assert that the configuration for `greeting_agent` (which is not in the config) correctly receives the default values (`type: "adk"`).

### Phase 2: Refactor Runners into a Base Class

This phase introduces a `BaseAgentRunner` to reduce code duplication and enforce a common interface.

-   **Step 2.1: Create `base_agent_runner.py`**
    -   **Action:** Create a new file: `backend/base_agent_runner.py`.

-   **Step 2.2: Define `BaseAgentRunner`**
    -   **File:** `backend/base_agent_runner.py`
    -   **Action:** Create an Abstract Base Class (ABC) named `BaseAgentRunner`.

-   **Step 2.3: Move Shared Logic to Base Class**
    -   **File:** `backend/base_agent_runner.py`
    -   **Action:**
        -   Move the `__init__` logic for common attributes (`agent_id`, `port`, etc.) from `AgentRunner` to the base class.
        -   Move the entire `stop` method from `AgentRunner` to the base class.
        -   Move the venv creation and `uv` installation logic into a concrete method in the base class.
        -   Move the helper functions (`_read_pip_stream`, `_read_stream_and_signal_start`) into this file.

-   **Step 2.4: Define Abstract Methods**
    -   **File:** `backend/base_agent_runner.py`
    -   **Action:** Define abstract methods that subclasses must implement:
        -   `_get_dependency_install_command(self) -> List[str]`
        -   `_get_agent_execution_command(self) -> List[str]`

-   **Step 2.5: Refactor `AgentRunner`**
    -   **File:** `backend/agent_runner.py`
    -   **Action:**
        -   Modify `AgentRunner` to inherit from `BaseAgentRunner`.
        -   Simplify its `start` method to call the base class's setup methods.
        -   Implement the abstract methods to return the correct commands for installing from `requirements.txt` and executing `agent_host.py`.

-   **Testing for Phase 2:**
    -   **Action:** Run the existing tests for `AgentRunner`.
    -   **Verify:** All tests should pass without modification, proving the refactor was successful and introduced no regressions.

### Phase 3: Implement the `A2AAgentRunner`

This phase creates the new runner, which is now much simpler thanks to the base class.

-   **Step 3.1: Create `a2a_agent_runner.py`**
    -   **Action:** Create a new file: `backend/a2a_agent_runner.py`.

-   **Step 3.2: Define the `A2AAgentRunner` Class**
    -   **File:** `backend/a2a_agent_runner.py`
    -   **Action:** Define `A2AAgentRunner` to inherit from `BaseAgentRunner`.

-   **Step 3.3: Implement Abstract Methods**
    -   **File:** `backend/a2a_agent_runner.py`
    -   **Action:** Implement the `_get_dependency_install_command` and `_get_agent_execution_command` methods to return the commands specified in the agent's `AgentConfig` (e.g., `uv pip install .` and `python __main__.py`).

-   **Testing for Phase 3:**
    -   **Action:** Create a unit test for the `A2AAgentRunner`.
    -   **Verify:** The test should assert that the class correctly generates the dependency and execution commands based on a sample A2A agent configuration.

### Phase 4: Implement the Runner Factory

This phase integrates the new runner into the main backend logic.

-   **Step 4.1: Modify the Agent Startup Logic**
    -   **File:** `backend/main.py`
    -   **Action:** Locate the `start_agent_process` function. This function will now become a "runner factory".

-   **Step 4.2: Implement the Factory Logic**
    -   **File:** `backend/main.py`
    -   **Action:**
        1.  Inside `start_agent_process`, use the agent's ID to look up its merged configuration.
        2.  Use a simple `if/else` statement on the `type` field.
        3.  If `type` is `"a2a"`, instantiate `A2AAgentRunner`.
        4.  If `type` is `"adk"`, instantiate `AgentRunner`.
        5.  Call `runner.start()` on the chosen instance.

-   **Testing for Phase 4:**
    -   **Action:** Create an integration test for the `start_agent_process` function.
    -   **Verify:** Use mocks/patches for the runner classes. The test should call `start_agent_process` for both an ADK and an A2A agent and assert that the correct runner class was instantiated.

### Phase 5: Integration and Manual Verification

This final phase ensures all the pieces work together in the running application.

-   **Step 5.1: Update Configuration**
    -   **Action:** Ensure the root `gallery.config.yaml` file is correctly configured for `dice_agent_rest`.

-   **Step 5.2: Manual End-to-End Test**
    -   **Action:**
        1.  Run the main gallery backend server.
        2.  Open the frontend in a browser.
        3.  **Test Case 1 (ADK Agent):** Start the `greeting_agent`. Verify it works as before.
        4.  **Test Case 2 (A2A Agent):** Start the `dice_agent_rest`. Verify it installs dependencies from `pyproject.toml` and starts successfully.
        5.  Stop both agents and verify they terminate cleanly.

### Phase 6: Debugging and Verification

This phase documents the debugging process for the A2A agent integration.

-   **Summary of Progress:**
    -   The Dual-Runner architecture (Phases 1-4) has been fully implemented.
    -   The `gallery.config.yaml` is correctly configured to identify `dice_agent_rest` as an `a2a` agent.
    -   The `A2AAgentRunner` now uses the correct execution strategy (`python -m <package_name>`) and runs from the appropriate parent directory to ensure Python's import resolution works correctly.
    -   Multiple `ImportError` issues within the `dice_agent_rest` sample agent itself have been identified and corrected by switching to relative imports.

-   **Current Blocker:**
    -   **Issue:** The `dice_agent_rest` agent fails to start with the error: `[Errno 2] No such file or directory: '.../.venv/bin/uv'`.
    -   **Root Cause:** This indicates that the `pip install uv` command, which runs during the initial virtual environment setup in the `BaseAgentRunner`, is failing silently. The error is not being captured or logged, preventing diagnosis.

-   **Debugging Steps Taken:**
    1.  **Manual Execution:** Confirmed that the agent *can* be started manually from the command line using the corrected execution strategy, proving the agent's code is now valid.
    2.  **Logging Enhancement (Attempt 1):** Added a `print()` statement to the asynchronous `_read_pip_stream` function. This was ineffective as the error is not a simple log line.
    3.  **Error Capturing (Attempt 2):** Modified the `BaseAgentRunner` to use `proc.communicate()` to synchronously capture the `stdout` and `stderr` of the `pip install uv` command. This was intended to raise an exception containing the full error message from `pip`.

-   **Current State:**
    -   The synchronous error capturing did not expose the underlying `pip` error as expected. The `FileNotFoundError` for the `uv` executable persists.

-   **Next Step:**
    -   The immediate priority is to diagnose the silent failure of the `pip install uv` command. The current error capturing mechanism is still insufficient. A more direct debugging approach is needed, potentially involving adding more verbose logging to the `subprocess` call itself or temporarily replacing the `pip install` command with a simpler command to test the venv's `python_executable`.
