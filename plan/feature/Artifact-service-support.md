# Feature: Artifact Service Support

**Summary:** This feature integrates the ADK's built-in Artifact Service, allowing agents to create and reference binary artifacts (like files and images) and for users to download them.

---

### User Stories

-   **Story 1:** As an agent developer, I want my agent to be able to create and save files (artifacts) so that it can produce outputs beyond simple text.
-   **Story 2:** As a user, when an agent tells me it has created a file, I want to be able to see a link to that file in the chat and download it.

### Implementation Plan

#### Backend

-   **Task: Integrate `ArtifactService` into the Agent Host.**
    -   In `backend/agent_host.py`, instantiate an `ArtifactService`. For the initial implementation, `google.adk.sessions.InMemoryArtifactService` is sufficient.
    -   Pass this `ArtifactService` instance to the `google.adk.runners.Runner` when it is created.

-   **Task: Create an Artifact Download Endpoint on the Agent Host.**
    -   In `backend/agent_host.py`, add a new GET endpoint to the agent's internal web server, for example: `/artifacts/{filename}`.
    -   This endpoint will use the `ArtifactService` instance to load the requested artifact's bytes by name and return them as a file response.

-   **Task: Create a Backend Proxy for Artifacts.**
    -   In the main backend (`main.py`), create a new GET endpoint, for example: `/agents/{agent_id}/artifacts/{filename}`.
    -   This endpoint will look up the correct agent's URL from the `running_processes` dictionary.
    -   It will then make a request to the agent's internal `/artifacts/{filename}` endpoint and stream the file content back to the client. This acts as a secure proxy.

#### Frontend

-   **Task: Update Chat UI to Recognize Artifact Links.**
    -   In `frontend/components/ChatInterface.tsx`, update the `ChatBubble` component or the message rendering logic.
    -   Use a regular expression to detect `artifact://` URIs in the agent's text responses.
    -   When a URI is detected, render it as an `<a>` tag (a clickable link) instead of plain text.

-   **Task: Construct Correct Download URLs.**
    -   The `href` for the rendered link should point to the new backend proxy endpoint.
    -   For an agent with ID `my-agent` and an artifact URI `artifact://report.pdf`, the generated URL should be `/api/agents/my-agent/artifacts/report.pdf`.
