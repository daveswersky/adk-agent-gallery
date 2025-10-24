# Feature: Hot-Reload Configuration

**Summary:** This feature will automatically reload the agent list in the Agent Gallery UI whenever the `gallery.config.yaml` file is modified, without requiring a server restart. This improves the developer experience by providing immediate feedback for configuration changes.

---

## Implementation Plan

### Phase 1: Backend File Watcher

This phase focuses on setting up a background task in the backend to monitor the configuration file for changes.

-   **Step 1.1: Add Dependency**
    -   **File:** `backend/requirements.txt`
    -   **Action:** Add the `watchfiles` library to the list of dependencies.

-   **Step 1.2: Refactor Agent Discovery**
    -   **File:** `backend/main.py`
    -   **Action:** Move the agent discovery logic currently inside the `@app.get("/agents")` endpoint into a new, reusable async function named `discover_agents()`. The `/agents` endpoint will then call this new function.

-   **Step 1.3: Create Background Watcher Task**
    -   **File:** `backend/main.py`
    -   **Action:**
        1.  Create a new async function named `watch_config_changes()`.
        2.  This function will use `watchfiles.awatch` to monitor `gallery.config.yaml`.
        3.  When a change is detected, it will re-read and re-parse the YAML file, updating the global `CONFIG` and `AGENT_CONFIGS` objects.
        4.  After reloading the config, it will call `discover_agents()` to get the new list of agents.
        5.  Finally, it will broadcast a new WebSocket message of type `agents_update` containing the new agent list to all connected clients.

-   **Step 1.4: Start the Watcher on Server Startup**
    -   **File:** `backend/main.py`
    -   **Action:** Use FastAPI's `@app.on_event("startup")` decorator to create a startup event handler that launches the `watch_config_changes()` function as a background task using `asyncio.create_task()`.

### Phase 2: Frontend WebSocket Handler

This phase updates the frontend to handle the new WebSocket message and update the UI.

-   **Step 2.1: Add New Message Type to Handler**
    -   **File:** `frontend/hooks/useManagementSocket.ts`
    -   **Action:** In the `ws.current.onmessage` event handler, add a new `else if` case to handle messages with `type: 'agents_update'`.

-   **Step 2.2: Update Agent State**
    -   **File:** `frontend/hooks/useManagementSocket.ts`
    -   **Action:**
        1.  When an `agents_update` message is received, call `setAgents()` with the new list of agents from the message payload (`message.data`).
        2.  To avoid losing the state of currently running agents, the logic should merge the new list with the existing list, preserving the `status` of any agent that exists in both the old and new lists.

-   **Step 2.3: Update Type Definitions**
    -   **File:** `frontend/types.ts`
    -   **Action:** Add `AgentsUpdateMessage` to the `ServerMessage` type union to ensure type safety.

### Phase 3: Manual Verification

-   **Step 3.1: Run the Application**
    -   **Action:** Start the backend and frontend servers.

-   **Step 3.2: Test the Hot-Reload**
    -   **Action:**
        1.  With the application running and the UI visible, open `gallery.config.yaml`.
        2.  Add or remove an agent from one of the `agent_roots` or change an agent's `type` in `agent_configs`.
        3.  Save the file.
    -   **Verify:**
        -   The backend console should log a message indicating it has detected a change and is reloading.
        -   The agent list in the frontend sidebar should update automatically without a page refresh to reflect the changes made in the configuration file.
