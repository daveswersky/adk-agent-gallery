# Epic: Container Mode

**Summary:** This epic introduces a new, parallel agent execution engine that uses Docker for process isolation instead of the current Python virtual environment (`venv`) approach. This will provide a more robust, production-like environment for running agents. The user will have the option to switch between the `venv` and `container` modes.

**Key Challenges:**
-   **New `ContainerAgentRunner`:** A new runner class is needed to manage the Docker container lifecycle.
-   **Backend Refactoring:** The core backend logic must be updated to support both runner types.
-   **Event Streaming:** A new event streaming mechanism is required, as the current OS-level pipe will not work across the container boundary.
-   **System Dependency:** This feature introduces a hard dependency on a running Docker daemon.

---

## Phase 1: Core Container Runner

This phase focuses on building the new `ContainerAgentRunner` and integrating it into the backend.

-   **Feature: `ContainerAgentRunner` Implementation**
    -   **Story:** As a backend developer, I want a new `AgentRunner` that can start, stop, and manage an agent running inside a Docker container.
    -   **Tasks:**
        -   Create a new class `ContainerAgentRunner` that mirrors the interface of the existing `AgentRunner`.
        -   Implement the `start()` method to:
            -   Find or generate a `Dockerfile` for the agent.
            -   Run `docker build` to create a container image.
            -   Run `docker run` to start the container, managing port mappings.
        -   Implement the `stop()` method to run `docker stop` and `docker rm`.
        -   Integrate a Python Docker client library (e.g., `docker-py`).

-   **Feature: Runner Selection Logic**
    -   **Story:** As a backend developer, I want the main application to be able to choose which runner to use for an agent.
    -   **Tasks:**
        -   Modify the `/start` command handler in `main.py` to accept a `mode` parameter (`venv` or `container`).
        -   Implement a factory pattern that instantiates the correct runner class based on the selected mode.

## Phase 2: Event Streaming for Containers

This is the most complex technical challenge: getting structured events from inside the container back to the main backend.

-   **Feature: WebSocket Event Channel**
    -   **Story:** As a `ContainerAgentRunner`, I need a reliable way to receive structured ADK events from the agent I'm managing.
    -   **Tasks:**
        -   Modify `agent_host.py` to, when run in container mode, open a WebSocket connection back to the main backend server.
        -   Create a new WebSocket endpoint on the main backend (e.g., `/ws/agent-events/{agent_id}`) to receive these events.
        -   Update the `EventStreamingPlugin` to write events to this WebSocket instead of the OS pipe when in container mode.
        -   The `ContainerAgentRunner` will listen for events on this dedicated channel and broadcast them to the frontend.

## Phase 3: Frontend Integration

This phase exposes the new mode to the user.

-   **Feature: Container Mode Toggle**
    -   **Story:** As a user, I want to be able to choose whether to run my agent in the standard `venv` mode or the new `container` mode.
    -   **Tasks:**
        -   Add a UI element (e.g., a toggle or dropdown) to the agent card or a settings panel to select the run mode.
        -   Update the `onStart` function in the frontend to pass the selected `mode` to the backend when sending the "start" command.
        -   The UI should clearly indicate which mode an agent is running in.
