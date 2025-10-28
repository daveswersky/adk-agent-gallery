# Pinned Agents Feature

This document outlines the implementation plan for the "Pinned Agents" feature.

## 1. Overview

The goal of this feature is to allow users to pin their favorite or most frequently used agents to the top of the agent list in the sidebar for easier access. The pinned state will be stored in the main `gallery.config.yaml` file.

## 2. Implementation Details

### 2.1. Configuration (`gallery.config.yaml`)

- A new top-level list key `pinned_agents` will be added to `gallery.config.yaml`.
- This list will contain the `id`s of the agents that should be pinned.

**Example `gallery.config.yaml`:**

```yaml
agent_roots:
  - name: "Core Agents"
    path: "agents"

pinned_agents:
  - "agents/greeting_agent"
  - "agents/weather_agent"
```

### 2.2. Backend (`backend/main.py`)

- The `/agents` endpoint in `main.py` will be modified.
- After discovering all agents from the `agent_roots`, it will read the `pinned_agents` list from the loaded `CONFIG`.
- It will then iterate through the discovered agents and add a new boolean attribute `pinned` to each agent's dictionary.
- If an agent's `id` is present in the `pinned_agents` list, `pinned` will be set to `true`; otherwise, it will be `false`.

### 2.3. Frontend

#### 2.3.1. Type Definition (`frontend/types.ts`)

- The `Agent` interface will be updated to include the new property:
  ```typescript
  export interface Agent {
    // ... existing properties
    pinned: boolean;
  }
  ```

#### 2.3.2. State Management (`frontend/hooks/useManagementSocket.ts`)

- The `useManagementSocket` hook will automatically receive the `pinned` property for each agent from the updated `/agents` endpoint.
- The sorting logic within the hook that populates `agentGroups` will be updated. The primary sort key will be `pinned` (descending), and the secondary sort key will be the existing status-based sorting. This will ensure pinned agents appear at the top of the "Running" group and their respective "Stopped" groups.

#### 2.3.3. UI (`frontend/components/AgentSidebar.tsx`)

- The `AgentListItem` component will be updated to visually indicate a pinned agent. A "pin" icon will be displayed next to the agent's name.
- A new button with a pin icon will be added to the `AgentListItem`. Clicking this button will eventually be used to toggle the pinned state. (Note: The initial implementation will focus on displaying the pinned state; toggling will be a future enhancement).
- The `sortAgentsByStatus` function will be modified to prioritize pinned agents.

```typescript
const sortAgentsByStatus = (agents: Agent[]): Agent[] => {
  const statusOrder = {
    [AgentStatus.RUNNING]: 1,
    [AgentStatus.STARTING]: 2,
    [AgentStatus.STOPPING]: 3,
    [AgentStatus.STOPPED]: 4,
    [AgentStatus.ERROR]: 5,
  };
  return [...agents].sort((a, b) => {
    if (a.pinned !== b.pinned) {
      return a.pinned ? -1 : 1;
    }
    return (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
  });
};
```

## 3. Development Phases

1.  **Phase 1 (Read-Only):** Implement the backend and frontend changes to read the pinned configuration from `gallery.config.yaml` and display it correctly in the UI.
2.  **Phase 2 (Interactive):** Implement the functionality to pin/unpin an agent directly from the UI. This will require a new backend endpoint to dynamically update `gallery.config.yaml`. (This phase is out of scope for the initial implementation).
