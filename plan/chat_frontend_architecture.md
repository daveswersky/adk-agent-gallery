A web-based frontend should structure its calls to an ADK agent using an **asynchronous polling** or **WebSocket** model. The key is to manage a persistent session or task ID, allowing the frontend to send an initial request and then repeatedly ask for updates as the `root_agent` uses tools or delegates to subagents.

-----

### \#\# Core Architectural Pattern: Asynchronous State Updates

Since an agent's task isn't instantaneous—it involves a "thought process" of calling tools and subagents—a simple request-response model will time out. The frontend needs to start a task and then get updates on its progress.

1.  **Initiate Task**: The frontend sends the user's request to a `/start_task` API endpoint.
2.  **Get Task ID**: The backend (your ADK agent server) immediately creates a unique `task_id` for this job and sends it back to the frontend. It then starts processing the request in the background.
3.  **Poll for Updates**: The frontend uses the `task_id` to periodically call an `/get_status` endpoint (e.g., every 1-2 seconds).
4.  **Receive and Render State**: The backend responds with the current state of the task. The frontend's main job is to interpret this state and render it appropriately.

This is a more robust alternative to keeping a single HTTP request open, which is fragile and not scalable. For real-time updates without polling, a **WebSocket** connection is an even better solution.

-----

### \#\# Structuring the API Calls and Payloads

Here is a breakdown of the communication flow between the frontend (client) and the ADK agent (server).

#### 1\. Start the Task

The frontend sends the initial prompt.

**Frontend Request:** `POST /api/agent/start`

```json
{
  "prompt": "Research the market for electric vehicles in Canada and summarize the findings.",
  "session_id": "existing_session_123" // Optional: to maintain conversation history
}
```

**Backend Response:**

The server immediately acknowledges the request and provides an identifier.

```json
{
  "task_id": "task_abc789"
}
```

#### 2\. Poll for Status Updates

The frontend now starts polling the status endpoint with the `task_id`.

**Frontend Request:** `GET /api/agent/status/task_abc789`

The backend will respond with one of several message types, which is the crucial part for the UI to handle.

**Backend Response Type A: Agent is Thinking**

Indicates the `root_agent` is processing or deciding the next step.

```json
{
  "task_id": "task_abc789",
  "status": "processing",
  "message": "Planning the research steps..."
}
```

The frontend should display a message like "🤖 Planning steps..."

**Backend Response Type B: Using a Tool**

The agent has decided to use a tool. The response includes the tool's name and its input.

```json
{
  "task_id": "task_abc789",
  "status": "tool_call",
  "tool": "WebSearchTool",
  "tool_input": { "query": "top selling electric vehicles in Canada 2025" },
  "message": "Using the WebSearchTool to find top selling EVs."
}
```

The frontend should now show something like "🔎 Searching the web for 'top selling electric vehicles in Canada 2025'..."

**Backend Response Type C: Delegating to a Subagent**

The `root_agent` has handed control to a `subagent`.

```json
{
  "task_id": "task_abc789",
  "status": "delegating",
  "subagent": "DataAnalysisSubagent",
  "subagent_input": { "topic": "Canadian EV market trends" },
  "message": "Delegating to the DataAnalysisSubagent to analyze market trends."
}
```

The UI should reflect this shift in control, maybe by showing "📊 Handing off to the DataAnalysisSubagent..."

**Backend Response Type D: Waiting for User Input**

This is for human-in-the-loop scenarios where the agent needs clarification or approval.

```json
{
  "task_id": "task_abc789",
  "status": "awaiting_input",
  "message": "I found three data sources. Which one should I prioritize?",
  "options": ["StatCan", "Transport Canada", "Industry Report"]
}
```

The frontend must now render a prompt for the user (e.g., buttons or a text box) and send the response back via a different endpoint.

**Backend Response Type E: Task is Complete**

The task is finished and the final result is available. Polling can now stop.

```json
{
  "task_id": "task_abc789",
  "status": "complete",
  "result": {
    "summary": "The Canadian EV market is growing, led by the Tesla Model Y...",
    "sources": ["..."]
  }
}
```

The frontend can now display the final, formatted answer.

This structure decouples the frontend from the backend's internal logic. The frontend only needs to know how to interpret the different `status` messages and render the UI accordingly, creating a responsive and transparent user experience.