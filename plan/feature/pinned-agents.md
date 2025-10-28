# Pinned Agents Feature

This document outlines the implementation plan for the "Pinned Agents" feature.

## 1. Overview

The goal of this feature is to allow users to pin their favorite or most frequently used agents to the top of the agent list in the sidebar for easier access. The pinned state will be stored in the main `gallery.config.yaml` file, and users will be able to modify it directly from the UI.

## 2. Development Phases

### Phase 1: Read-Only Display (Completed)

-   **Backend:** The `/agents` endpoint reads a `pinned_agents` list from `gallery.config.yaml` and adds a `pinned: true/false` attribute to each agent object.
-   **Frontend:** The UI uses the `pinned` attribute to display a pin icon and sort pinned agents to the top of the list.

### Phase 2: Interactive Pinning

This phase makes the pinning functionality interactive, allowing users to pin and unpin agents directly from the UI.

#### 2.1. Backend (`main.py`)

A new API endpoint will be created to handle updates to the pinned agents list.

-   **Endpoint:** `POST /config/pinned_agents`
-   **Request Body:**
    ```json
    {
      "agent_id": "agents/greeting_agent",
      "pin": true
    }
    ```
-   **Logic:**
    1.  **Read Config:** The endpoint will read the current `gallery.config.yaml`. To preserve comments and formatting, it's highly recommended to use a library like `ruamel.yaml` instead of the standard `PyYAML`.
    2.  **Modify List:** It will find the `pinned_agents` list in the loaded configuration (or create it if it doesn't exist).
    3.  It will add the `agent_id` to the list if `pin` is `true` and the ID isn't already present.
    4.  It will remove the `agent_id` from the list if `pin` is `false` and the ID exists.
    5.  **Write Config:** The modified configuration object will be written back to `gallery.config.yaml`, preserving the file's structure.
    6.  **Hot Reload:** After successfully writing the file, the backend will trigger the same "hot reload" mechanism used by the file watcher. It will re-parse the configuration, re-discover the agents, and broadcast a new `agents_update` message to all connected clients via the WebSocket. This ensures all users see the change instantly.

#### 2.2. Frontend

-   **`frontend/components/AgentSidebar.tsx`**:
    -   The `PinIcon` in the `AgentListItem` will be wrapped in a `<button>`.
    -   An `onTogglePin` function will be passed down to the `AgentListItem`.
    -   The button's `onClick` handler will call `onTogglePin(agent.id, !agent.pinned)`, stopping event propagation to prevent selecting the agent.
    -   The icon's appearance will be updated to be more button-like on hover.

-   **`frontend/hooks/useManagementSocket.ts`**:
    -   A new function, `toggleAgentPin`, will be created. This function will be responsible for sending the request to the new backend endpoint.
    -   It will take `agentId` and `isPinned` as arguments and make a `POST` request to `/config/pinned_agents`.
    -   The hook will be updated to handle the `agents_update` message broadcast by the backend. This is the same message used by the config hot-reload feature, so the existing logic should handle the UI update automatically. No optimistic UI update is needed, as the WebSocket message will be the source of truth.

-   **New Service (`frontend/services/configService.ts`)**:
    -   A new service file will be created to encapsulate the API call.
    -   It will contain a function like `updatePinnedAgents(agentId: string, pin: boolean)`.