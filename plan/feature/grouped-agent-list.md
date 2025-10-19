# Grouped Agent List

## Objective

Refactor the agent sidebar to display agents in collapsible groups based on the `agent_roots` defined in `gallery.config.yaml`. This will be a frontend-only change, ensuring no regressions in the agent path values passed to the backend.

## Backend Implementation

### 1. Configuration Loading

- On startup, the main FastAPI application in `backend/main.py` will read and parse the `gallery.config.yaml` file.
- The `agent_roots` data will be stored in a global variable or application state so it's accessible to new WebSocket connections.

### 2. Sending Configuration to Frontend

- When a new frontend client establishes a WebSocket connection, the backend will immediately send a message containing the `agent_roots` configuration.
- A new message type, `config`, will be used for this purpose.

**Example (`main.py`):**
```python
# (Simplified)
import yaml

# Load config at startup
CONFIG = {}
with open("gallery.config.yaml", "r") as f:
    CONFIG = yaml.safe_load(f)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    # Send config on connect
    await websocket.send_json({"type": "config", "data": CONFIG.get("agent_roots", [])})
    
    # ... existing connection logic
```

## Frontend Implementation

### 1. Data Processing

- The `useManagementSocket` hook in `frontend/hooks/useManagementSocket.ts` will be the central place to process agent data.
- It will listen for the new `config` message from the WebSocket and store the received `agent_roots` in its state.
- A new data structure will be created to group the agents. We will transform the flat `Agent[]` array into a structure like `GroupedAgents[]`, where each `GroupedAgents` object contains a `name` (from the config) and an `agents` array.

```typescript
// In frontend/types.ts
export interface AgentGroup {
  name: string;
  agents: Agent[];
}
```

### 2. Component Changes

- **`AgentSidebar.tsx`**: This component will be modified to render the new `AgentGroup[]` data structure.
    - It will iterate over the groups and render a collapsible section for each.
    - The group header will be the `group.name`.
    - Inside each collapsible section, it will map over the `group.agents` and render the existing `AgentCard.tsx` for each agent.

### 3. State Management

- The state within `useManagementSocket.ts` will be updated to store the grouped agents and the received `agent_roots` config.
- The existing filtering logic will be adapted to work with the new grouped structure.

## Example Pseudocode (`useManagementSocket.ts`)

```typescript
const [agents, setAgents] = useState<Agent[]>([]);
const [agentGroups, setAgentGroups] = useState<AgentGroup[]>([]);
const [agentRoots, setAgentRoots] = useState<any[]>([]); // from backend

// In the WebSocket message handler
socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.type === 'config') {
        setAgentRoots(message.data);
    }
    // ... other message types
};

// When agents list or roots are updated
useEffect(() => {
  if (agentRoots.length > 0 && agents.length > 0) {
    const groups: AgentGroup[] = agentRoots.map(root => ({
      name: root.name,
      agents: agents.filter(agent => agent.id.startsWith(root.path))
    }));
    setAgentGroups(groups);
  }
}, [agents, agentRoots]);

// ... rest of the hook
```

## Avoiding Regressions

The key is to ensure that the `agent.id` (which is the path) passed to the `startAgent` and `stopAgent` functions remains unchanged. Since we are only changing the presentation layer (`AgentSidebar.tsx`) and how the data is structured for display, the underlying `Agent` object, including its `id`, will be preserved.
