# Feature: Connect to Running Agent

**Summary:** This feature allows the gallery to act as a client for agents that are running externally (i.e., not started by the gallery). The user will provide a URL, and the gallery will add the agent to its list for interaction, disabling management features like start/stop.

---

### User Stories

-   **Story 1:** As a developer, I have an agent running on a remote server (e.g., in Cloud Run) and I want to use the Agent Gallery's chat interface to interact with it for testing and demonstration.

### Implementation Plan

#### Backend

-   **Task: Create a Data Store for External Agents.**
    -   In `backend/main.py`, create a new in-memory dictionary (e.g., `external_agents`) to store the information about registered external agents (name, URL, description).

-   **Task: Create an API Endpoint for Registration.**
    -   Define a new `POST` endpoint, for example: `/agents/external`.
    -   This endpoint will accept a JSON body with the agent's `name`, `url`, and `description`, and add it to the `external_agents` dictionary.

-   **Task: Update the Agent List Endpoint.**
    -   Modify the existing `/agents` endpoint.
    -   After discovering local agents from the filesystem, it should merge the list of registered external agents into the response.
    -   Add a new field to the agent object, e.g., `"type": "local"` or `"type": "external"`, to allow the frontend to distinguish between them.

-   **Task: Update the `run_turn` Logic.**
    -   In the `/run_turn` endpoint, before calling the local `AgentRunner`, check if the requested `agent_name` exists in the `external_agents` dictionary.
    -   If it is an external agent, make a direct HTTP POST request to the registered URL, forwarding the prompt.
    -   Return the response from the external agent to the client.

#### Frontend

-   **Task: Create a UI for Adding External Agents.**
    -   Add a new button to the `AgentSidebar` (e.g., a "+" icon).
    -   This button will open a modal with a form for the user to enter the agent's Name, Description, and URL.
    -   On submit, the form will call the new `/agents/external` backend endpoint.

-   **Task: Update the Agent List UI.**
    -   In `frontend/components/AgentListItem.tsx`, add logic to handle the new `type` field.
    -   If the agent `type` is "external", the "Start" and "Stop" buttons should be disabled or hidden.
    -   The status badge could show a static "External" or "Connected" status.
    -   The "View Code" button should also be hidden, as the source is not available.

-   **Task: Refresh Agent List After Registration.**
    -   After a user successfully registers a new external agent, the frontend should automatically refresh its agent list to display the newly added agent.
