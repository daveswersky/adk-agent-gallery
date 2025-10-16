# Feature: Agent Code View

**Summary:** This feature provides a simple way for a user to view the source code of an agent directly from the UI. A new icon will be added to each agent's card, which will open a modal or a viewer pane displaying the content of the agent's primary Python file.

---

### User Stories

-   **Story 1:** As a developer, I want to quickly inspect the source code of an agent from the Agent Gallery UI so that I can understand its functionality without having to find the file in my IDE.

### Implementation Plan

#### Backend

-   **Task: Create a new API endpoint to fetch agent code.**
    -   Define a new GET endpoint in `main.py`, for example: `/agents/{agent_id}/code`.
    -   This endpoint will take an `agent_id` as a path parameter.
    -   It will use the existing logic for finding an agent's directory, locate the primary `agent.py` file within that directory, read its contents, and return them in a JSON response (e.g., `{ "filename": "agent.py", "content": "..." }`).

#### Frontend

-   **Task: Add a "View Code" button to the agent list item.**
    -   In the `frontend/components/AgentListItem.tsx` component, add a new icon button (e.g., a code symbol).
    -   This button will be placed alongside the existing "Start" and "Stop" buttons.

-   **Task: Implement the code fetching logic.**
    -   Create a new function in `frontend/services/agentService.ts` to call the new `/agents/{agent_id}/code` backend endpoint.
    -   This function will take the `agent_id` and return the file content.

-   **Task: Create a code viewer modal.**
    -   Create a new reusable modal component (`CodeViewerModal.tsx`).
    -   This component will take the code content as a prop and display it in a formatted, scrollable view (e.g., using a `<pre>` tag).
    -   Consider adding a simple syntax highlighting library for better readability, but this can be a follow-up enhancement.

-   **Task: Integrate the modal into the main UI.**
    -   In `App.tsx`, add state to manage the visibility of the code viewer modal and to hold the code content.
    -   The "View Code" button's `onClick` handler will call the new service function, set the code content in the state, and open the modal.
