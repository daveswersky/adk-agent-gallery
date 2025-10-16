# Epic: Agent-to-Agent (A2A) Communication

**Summary:** This epic covers the architectural changes required to enable agents running within the gallery to communicate with each other. The current architecture isolates each agent in its own subprocess, preventing any form of direct interaction.

**Key Challenges:**
-   **Communication Infrastructure:** A system for inter-agent message passing must be designed and built.
-   **Core Agent Logic (`google-adk`):** The ADK `Runner` must be adapted to handle events from other agents.
-   **API and State Management:** The concept of a "turn" needs to be expanded to support multi-agent conversations.
-   **Frontend UI:** The UI needs to be updated to visualize A2A interactions.

---

## Phase 1: Backend Infrastructure (The Message Bus)

This phase focuses on creating the core communication channel. The simplest approach is to use the main backend server as a central message broker.

-   **Feature: A2A Message Broker API**
    -   **Story:** As a backend developer, I want to create a new WebSocket or HTTP endpoint that agents can use to send messages to other agents.
    -   **Tasks:**
        -   Design a message format (e.g., `{ "sender": "agent_a", "recipient": "agent_b", "payload": ... }`).
        -   Implement a new endpoint (e.g., `/a2a/send`) on the main FastAPI backend.
        -   This endpoint will look up the recipient agent in the `running_processes` dictionary and forward the message to it.

-   **Feature: Agent-level A2A Listener**
    -   **Story:** As an agent, I need a way to receive messages forwarded by the central broker.
    -   **Tasks:**
        -   Add a new endpoint (e.g., `/receive_a2a_message`) to the agent's internal web server in `agent_host.py`.
        -   This endpoint will receive the message and needs a mechanism to inject it into the running ADK `Runner`. This is a complex task and a key part of the ADK integration.

## Phase 2: ADK and Agent Logic Integration

This phase is about making the agents "A2A-aware".

-   **Feature: A2A Tool for Agents**
    -   **Story:** As an agent developer, I want a simple tool that my agent can use to send a message to another agent.
    -   **Tasks:**
        -   Create a new standard `a2a_tool` that can be imported and used by any agent.
        -   This tool will have a function like `send_message(recipient_agent_name: str, message: str)`.
        -   The tool's implementation will simply make an HTTP request to the backend's `/a2a/send` endpoint.

-   **Feature: ADK Runner A2A Integration**
    -   **Story:** As the ADK `Runner`, I need to be able to process incoming A2A messages as if they were user input.
    -   **Tasks:**
        -   Modify the `agent_host.py` script to handle the injection of messages received by the A2A listener.
        -   This will likely involve calling the `runner.run_async()` method with the new message, which requires careful state and session management. This work is highly dependent on the **Multi-session support** epic.

## Phase 3: Frontend Visualization

This phase focuses on the user-facing aspect of A2A.

-   **Feature: A2A Event Visualization**
    -   **Story:** As a user, I want to see when an agent sends or receives a message from another agent.
    -   **Tasks:**
        -   Expand the `EventStreamingPlugin` to generate new event types, `a2a_message_sent` and `a2a_message_received`.
        -   Update the `EventViewer` and `ChatInterface` to render these new events, clearly showing the sender and recipient.

-   **Feature: Agent Grouping UI**
    -   **Story:** As a user, I want the UI to visually group agents that are actively communicating with each other.
    -   **Tasks:**
        -   The backend will need to track which agents are in a "conversation".
        -   The frontend `AgentSidebar` will need to be updated to dynamically render these groups, perhaps by drawing a line between them or placing them in a container.
