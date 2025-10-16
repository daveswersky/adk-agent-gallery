# Feature: Event Viewer

**Summary:** This feature will create a dedicated UI component to display the full, structured stream of events from the ADK. This involves expanding the existing backend plugin to capture more event types and building a new frontend component to render the hierarchical event data.

---

### User Stories

-   **Story 1:** As a developer debugging my agent, I want to see the complete, ordered sequence of events (turn start/end, LLM start/end, tool calls, etc.) in a structured view to understand exactly how my agent is executing.

### Implementation Plan

#### Backend

-   **Task: Expand the `EventStreamingPlugin`.**
    -   In `backend/event_streaming_plugin.py`, implement more of the `BasePlugin` hooks to capture a wider range of events.
    -   Key hooks to add:
        -   `on_start_turn(self, *, turn)`
        -   `on_end_turn(self, *, turn)`
        -   `on_start_llm(self, *, turn, llm_request)`
        -   `on_end_llm(self, *, turn, llm_response)`
        -   `on_error(self, *, error)`
    -   For each hook, serialize the event data to a JSON object and write it to the event pipe, similar to the existing `before_tool_callback`.

#### Frontend

-   **Task: Persist Events in State.**
    -   In the `frontend/hooks/useManagementSocket.ts` hook, modify the state management.
    -   Instead of having a transient `agentEvents` array that is cleared after use, create a persistent state variable (e.g., `eventLog`) that accumulates all `agent_event` messages received from the WebSocket.
    -   This log should be cleared when an agent is stopped or a new session is started.

-   **Task: Create the `EventViewer` Component.**
    -   Create a new component `frontend/components/EventViewer.tsx`.
    -   This component will accept the `eventLog` array as a prop.
    -   It should render the list of events in a structured, readable format. A simple list of collapsible JSON viewers would be a good first implementation.
    -   **Stretch Goal:** Implement a tree view to represent the parent-child relationships between events for a more intuitive display.

-   **Task: Integrate `EventViewer` into the `InfoPane`.**
    -   In `frontend/components/InfoPane.tsx`, add a new tab next to the existing "Logs" tab, labeled "Events".
    -   The `InfoPane` will need to receive the `eventLog` state from `App.tsx`.
    -   Render the new `EventViewer` component when the "Events" tab is active.
