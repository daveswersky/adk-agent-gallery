# Markdown Support Feature Plan

## 1. Overview

The goal of this feature is to enhance the user experience by rendering agent responses in the chat interface as Markdown. This will allow for richer formatting, such as headers, lists, bold/italic text, code blocks, and links, making the agent's output more readable and useful.

This is primarily a frontend-focused feature.

## 2. Requirements

- Agent responses containing Markdown syntax should be rendered correctly in the `ChatInterface`.
- The rendering should be safe from XSS attacks.
- The styling of the rendered Markdown should be consistent with the overall application theme.
- Plain text responses (without Markdown) should continue to display correctly.

## 3. Technical Design

### 3.1. Frontend

The core of this feature will be implemented in the `frontend/components/ChatInterface.tsx` component.

1.  **Dependency Selection:** We will use a well-vetted, secure, and popular library for rendering Markdown in React. `react-markdown` is the leading candidate. It is secure by default (sanitizes HTML) and highly customizable.

2.  **Installation:**
    ```bash
    npm install react-markdown
    ```

3.  **Implementation:**
    - In `ChatInterface.tsx`, locate the part of the component that renders the agent's message content.
    - Replace the simple text rendering with the `<ReactMarkdown>` component.
    - The `children` prop of `<ReactMarkdown>` will be the agent's message string.

    **Example (Conceptual):**

    ```tsx
    // Before
    <div className="agent-message">{message.text}</div>

    // After
    import ReactMarkdown from 'react-markdown';
    // ...
    <div className="agent-message">
      <ReactMarkdown>{message.text}</ReactMarkdown>
    </div>
    ```

4.  **Styling:**
    - We will need to add some basic CSS to style the rendered Markdown elements (e.g., `h1`, `p`, `ul`, `li`, `code`).
    - These styles will be added to `frontend/index.css` to ensure they are globally available and consistent with the application's design.

### 3.2. Backend

No backend changes are required for this feature. The backend will continue to pass agent responses to the frontend as raw strings.

## 4. Implementation Plan (Tasks)

1.  **Install `react-markdown`:** Add the dependency to `package.json`.
2.  **Modify `ChatInterface.tsx`:**
    - Import `ReactMarkdown`.
    - Update the message rendering logic to use the `<ReactMarkdown>` component for agent messages.
3.  **Add CSS Styling:**
    - Add styles for common Markdown elements to `index.css` to match the application's aesthetic.
4.  **Testing:**
    - Manually test with an agent that produces Markdown (e.g., modify the `greeting_agent` temporarily).
    - Verify that various Markdown features work as expected (headings, lists, bold, code snippets).
    - Verify that plain text messages are still rendered correctly.
    - Verify that there are no styling conflicts.

## 5. Effort Assessment

- **Effort:** Low. This is a small, self-contained feature.
- **Time Estimate:** 1-2 hours.
- **Risk:** Low. The main risk is potential styling conflicts, which are straightforward to resolve with CSS.
