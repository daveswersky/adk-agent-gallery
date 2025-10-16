# Epic: Live Agent Support

**Summary:** This epic introduces support for real-time, streaming voice and video agents using the Gemini Live API. This represents a new, parallel mode of interaction within the Agent Gallery, distinct from the existing text-based, turn-based ADK agents.

**Key Challenges:**
-   **New Real-time Backend:** A new backend service is required to manage the persistent, low-latency, bi-directional stream with the Gemini Live API.
-   **New Frontend UI:** A completely new chat interface is needed to handle microphone input and real-time audio/video playback.
-   **Browser Media APIs:** The frontend will need to use low-level browser APIs to capture and process media.
-   **New Communication Protocol:** The application needs to support real-time streaming protocols (e.g., WebRTC or a specialized WebSocket setup).

---

## Phase 1: Backend Streaming Service

This phase focuses on building the backend infrastructure to proxy the Gemini Live API.

-   **Feature: Live Agent Proxy Service**
    -   **Story:** As a backend developer, I want a service that can manage a persistent, bi-directional stream between a client and the Gemini Live API.
    -   **Tasks:**
        -   Create a new WebSocket endpoint (e.g., `/ws/live/{agent_id}`) for real-time communication.
        -   Integrate the Google AI client libraries for the Live API.
        -   Implement the logic to receive an audio/video stream from the client, forward it to the Live API, receive the response stream, and forward it back to the client.
        -   Handle authentication with Google Cloud.

## Phase 2: Frontend Live Chat Interface

This phase focuses on building the new user interface for real-time interaction.

-   **Feature: Microphone and Audio Playback UI**
    -   **Story:** As a user, I want to be able to speak to a Live Agent and hear its response in real-time.
    -   **Tasks:**
        -   Create a new `LiveChatInterface.tsx` component that will be rendered when a Live Agent is selected.
        -   Use browser APIs (`navigator.mediaDevices.getUserMedia`) to capture audio from the user's microphone.
        -   Implement the logic to encode this audio into the required format (16-bit PCM, 16kHz) and send it over the WebSocket.
        -   Implement the logic to receive the audio stream from the backend, decode it, and play it through the user's speakers.

-   **Feature: Live Agent UI State Management**
    -   **Story:** As a user, I want to see the status of my connection and the agent's activity.
    -   **Tasks:**
        -   Add UI elements to show connection status (connecting, connected, disconnected).
        -   Implement a "push-to-talk" button or a voice activity indicator.
        -   Display a transcript of the conversation as it happens.

## Phase 3: Integration and Agent Definition

This phase integrates the new mode into the main application.

-   **Feature: Live Agent Type**
    -   **Story:** As a user, I want to be able to distinguish Live Agents from standard ADK agents in the gallery.
    -   **Tasks:**
        -   Define a new "agent type" in the backend's agent discovery mechanism.
        -   The `/agents` endpoint should return this type information.
        -   The `AgentSidebar` in the frontend should display a different icon or label for Live Agents.
        -   The main `App.tsx` component will use this type to conditionally render either the `ChatInterface` or the new `LiveChatInterface`.
