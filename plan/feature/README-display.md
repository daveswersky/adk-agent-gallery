# README display for non-running agents

## Assessment

This feature will display the README.md file for a selected agent in the ChatInterface pane when the agent is not running. This is a **FEATURE**-level task that involves both frontend and backend changes.

-   **Frontend:** Changes are required to allow selecting a non-running agent and displaying the fetched README content in the main chat pane. This involves modifying `App.tsx`, `AgentSidebar.tsx`, and `ChatInterface.tsx`.
-   **Backend:** A new API endpoint is needed to read and return the content of an agent's `README.md` file.

The effort is moderate due to the number of components that need to be touched, but the logic is straightforward.

## Implementation Plan

### 1. Backend: Create README Endpoint

-   **File:** `backend/main.py`
-   **Action:** Add a new GET endpoint `/agents/{agent_id}/readme`.
-   **Logic:**
    -   The endpoint will take an `agent_id` as a path parameter.
    -   It will locate the agent's directory based on the `agent_id`.
    -   It will check if a `README.md` file exists in that directory.
    -   If it exists, read and return the file's content with a 200 OK status.
    -   If it does not exist, return a 404 Not Found with a JSON error message.

### 2. Frontend: Service to Fetch README

-   **File:** `frontend/services/agentService.ts`
-   **Action:** Add a new function `getAgentReadme(agentId: string)`.
-   **Logic:**
    -   This function will make a GET request to the new `/agents/{agent_id}/readme` endpoint.
    -   It will handle the response, returning the text content on success and throwing an error on failure (e.g., 404).

### 3. Frontend: Allow Selection of Non-Running Agents

-   **File:** `frontend/components/AgentSidebar.tsx`
-   **Component:** `AgentListItem`
-   **Action:** Modify the `onClick` handler.
-   **Logic:**
    -   Remove the `isRunning` condition from the `onClick` handler of the main `div`. It should now be `onClick={() => onSelect(agent)}`.
    -   Remove the conditional `cursor-pointer` class. It should always be applied.

-   **File:** `frontend/App.tsx`
-   **Function:** `handleSelectAgent`
-   **Action:** Update the selection logic.
-   **Logic:**
    -   The function should now set the selected agent regardless of its status. The existing logic `if (agent.status === AgentStatus.RUNNING)` should be removed.

### 4. Frontend: State Management for README

-   **File:** `frontend/App.tsx`
-   **Action:** Add new state to manage README content and loading status.
-   **Logic:**
    -   `const [readmeContent, setReadmeContent] = useState<string | null>(null);`
    -   `const [isReadmeLoading, setIsReadmeLoading] = useState<boolean>(false);`
-   **Action:** Update `handleSelectAgent` to fetch the README.
-   **Logic:**
    -   When an agent is selected:
        -   Set the `selectedAgent`.
        -   If `agent.status !== AgentStatus.RUNNING`:
            -   Set `setIsReadmeLoading(true)`.
            -   Set `setReadmeContent(null)`.
            -   Call `getAgentReadme(agent.id)`.
            -   On success, set the content in `readmeContent`.
            -   On error (e.g., no README), set `readmeContent` to a specific "not found" message.
            -   Finally, set `setIsReadmeLoading(false)`.
        -   If `agent.status === AgentStatus.RUNNING`:
            -   Set `setReadmeContent(null)`.

### 5. Frontend: Display README in Chat Interface

-   **File:** `frontend/components/ChatInterface.tsx`
-   **Action:** Add new props and update rendering logic.
-   **Props:**
    -   `readmeContent: string | null`
    -   `isReadmeLoading: boolean`
-   **Logic:**
    -   The main conditional rendering block will be updated:
        -   If `isReadmeLoading` is true, display a loading spinner.
        -   If `agent` is selected but not running, and `readmeContent` is not null, render the `readmeContent` using the `ReactMarkdown` component inside a styled container.
        -   If `agent` is running, render the existing chat interface.
        -   If no agent is selected, render the welcome message.

### 6. Frontend: Update `App.tsx` Component Invocation

-   **File:** `frontend/App.tsx`
-   **Action:** Pass the new props to the `<ChatInterface />` component.
-   **Logic:**
    -   `<ChatInterface ... readmeContent={readmeContent} isReadmeLoading={isReadmeLoading} />`
