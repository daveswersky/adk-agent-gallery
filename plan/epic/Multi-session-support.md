# Epic: Multi-session Support

**Summary:** This epic covers the work required to enable stateful, multi-turn conversations with agents. While the frontend already has a session management concept, the backend is currently stateless. This epic focuses on re-architecting the backend to properly integrate with the ADK's session management capabilities and building the UI to manage multiple sessions.

**Key Challenges:**
-   **Backend Rearchitecture:** The core interaction between the main backend and the agent subprocesses must be changed from a stateless to a stateful model.
-   **ADK Integration:** The `agent_host.py` script must be rewritten to use the stateful `google.adk.runners.Runner` and `Session` objects.
-   **Persistence:** A storage layer is needed to save, load, and delete session history.

---

## Phase 1: Stateful Backend Rearchitecture

This phase is the most critical and complex, focusing on making the backend session-aware.

-   **Feature: Stateful Agent Host**
    -   **Story:** As an agent host, I want to maintain conversational state across multiple turns for a given session ID by using the ADK's built-in session management.
    -   **Tasks:**
        -   Rewrite the endpoint in `agent_host.py` to no longer be a simple stateless function.
        -   Instantiate a `google.adk.runners.Runner` and a `google.adk.sessions.InMemorySessionService`.
        -   On each request, use the `runner.run_async()` method, passing the `session_id` and `new_message` (including history) to maintain context.

-   **Feature: Update Backend API for Sessions**
    -   **Story:** As the main backend, I want to receive and pass session information to the correct agent runner.
    -   **Tasks:**
        -   Update the `/run_turn` endpoint in `main.py` to accept a `session_id` and the conversation `history`.
        -   Update the `AgentRunner.run_turn` method to forward this session information to the agent subprocess's web server.

## Phase 2: Frontend Session Management UI

This phase focuses on building the user-facing components for managing sessions.

-   **Feature: Session Creation and Switching UI**
    -   **Story:** As a user, I want to start a new, clean conversation with an agent at any time, and be able to switch between my different conversations.
    -   **Tasks:**
        -   Add a "New Chat" button to the `ChatInterface`.
        -   Create a new UI component (e.g., a list in the sidebar) to display all active sessions for the selected agent.
        -   Implement the logic to switch the `ChatInterface` to display the history of the selected session.

-   **Feature: Session Persistence UI (Save/Delete)**
    -   **Story:** As a user, I want to save important conversations for later and delete conversations I no longer need.
    -   **Tasks:**
        -   Add "Save" and "Delete" buttons to the session management UI.
        -   These buttons will trigger calls to new backend API endpoints for persistence.

## Phase 3: Backend Persistence Layer

This phase implements the storage for saved sessions.

-   **Feature: Session Persistence API**
    -   **Story:** As a backend developer, I want to provide API endpoints to save, load, and delete session histories.
    -   **Tasks:**
        -   Create new API endpoints: `POST /sessions` (save), `GET /sessions/{agent_id}` (load all for agent), and `DELETE /sessions/{session_id}`.
        -   Implement a simple storage mechanism. A first version could save each session's history as a separate JSON file on the server's filesystem.
