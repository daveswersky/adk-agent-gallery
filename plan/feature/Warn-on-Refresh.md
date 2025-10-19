# Warn on Browser Refresh Feature Plan

## 1. Overview

Currently, all agent session data (chat history) is stored in memory on the frontend. If a user accidentally refreshes or closes the browser tab, this state is lost without warning, which can be a frustrating user experience.

This feature will implement a simple confirmation dialog to warn users that they will lose their session data before the page is unloaded.

## 2. Requirements

- When a user attempts to refresh or close the browser tab, a native browser confirmation dialog should appear.
- The dialog should clearly state that unsaved session progress will be lost.
- The warning should only appear if there is at least one active agent session with chat history.

## 3. Technical Design

### 3.1. Frontend

This is a frontend-only feature. The implementation will use the standard browser `beforeunload` event.

1.  **Location:** The logic will be added to the main `frontend/App.tsx` component, as it's a global concern.

2.  **Implementation:**
    - A `useEffect` hook will be used to add and remove the event listener for the component's lifecycle.
    - An event handler function, `handleBeforeUnload`, will be created.
    - Inside this function, we will check for the existence of active sessions. A simple way is to check if the `sessionManager` has any sessions stored.
    - If active sessions exist, the handler will call `event.preventDefault()` and set `event.returnValue` to a warning string. Modern browsers typically show a generic message, but setting `returnValue` is required for the prompt to appear.

    **Example (Conceptual):**

    ```tsx
    // In App.tsx
    useEffect(() => {
      const handleBeforeUnload = (event: BeforeUnloadEvent) => {
        // Check if sessionManager has any sessions with history
        if (sessionManager.hasActiveSessions()) { // This method needs to be created
          event.preventDefault();
          event.returnValue = ''; // Required for the prompt to show
        }
      };

      window.addEventListener('beforeunload', handleBeforeUnload);

      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }, []);
    ```

3.  **Session Manager Enhancement:**
    - A new method, `hasActiveSessions()`, will be added to the `sessionManager` service (`frontend/services/sessionManager.ts`). This method will check if its internal `sessions` map is not empty and if at least one session has a history length greater than zero.

### 3.2. Backend

No backend changes are required.

## 4. Implementation Plan (Tasks)

1.  **Update `sessionManager.ts`:** Add the new `hasActiveSessions()` method.
2.  **Modify `App.tsx`:** Add the `useEffect` hook to manage the `beforeunload` event listener as described above.
3.  **Testing:**
    - Load the application and refresh the page (no warning should appear).
    - Start an agent and have a brief conversation.
    - Attempt to refresh the page.
    - **Verify** that the browser's confirmation dialog appears.
    - Stop all agents, clearing the sessions.
    - Attempt to refresh the page again.
    - **Verify** that the warning no longer appears.

## 5. Effort Assessment

- **Effort:** Low.
- **Time Estimate:** 1 hour.
- **Risk:** Low. This is a standard browser feature and a self-contained change.
