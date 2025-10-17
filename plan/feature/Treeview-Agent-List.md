# Feature: Treeview Agent List

**Effort Assessment:** FEATURE

## Summary

Refactor the agent listing sidebar to display agents in a condensed, file-system-like tree view. This will optimize the UI for projects with a large number of agents, making it easier to navigate and find specific agents.

## Implementation Plan

### Frontend

1.  **Create a new `TreeView` component:**
    *   This component will be responsible for rendering the nested structure of agents.
    *   It will take the list of agents as a prop.
    *   It will need to process the agent list, which is currently flat, and group them by their parent directories (e.g., `adk-samples/python/agents/data-science`).
    *   It will manage the state of expanded/collapsed nodes.

2.  **Modify `AgentSidebar.tsx`:**
    *   Replace the current `AgentGallery` component with the new `TreeView` component.
    *   Pass the agent list to the `TreeView` component.

3.  **Modify `AgentCard.tsx` (or create a new `TreeItem.tsx`):**
    *   The current `AgentCard` is designed for a flat list. A new, more compact component might be needed to represent an agent within the tree. This component would be a "leaf" in the tree.
    *   The "folders" in the tree will also need a component to render them, with a click handler to expand/collapse.

4.  **Styling:**
    *   Add CSS to style the tree view, including indentation for nested levels and icons for folders and agents.

### Backend

No backend changes are anticipated for this feature. The backend already provides the full path to each agent, which the frontend can use to construct the tree.
