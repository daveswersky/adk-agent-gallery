# Improved Code Viewer Implementation Plan

## Feature

Improved Code Viewer

## Goal

When a user clicks the "View Code" button for an agent that has sub-agents, the code viewer modal should display a tabbed interface. The first tab will show the main agent's code, and subsequent tabs will show the code for each sub-agent.

## Backend Changes

1.  **Create a new API endpoint:**
    -   `GET /api/agents/{agent_name}/code_with_subagents`
2.  **Endpoint Logic:**
    -   The endpoint will receive an `agent_name` as a path parameter.
    -   It will locate the main agent's directory.
    -   It will read the content of the main agent's `agent.py` file (or equivalent).
    -   It will check for the existence of a `sub_agents` directory within the main agent's directory.
    -   If a `sub_agents` directory exists, it will iterate through each subdirectory (each representing a sub-agent).
    -   For each sub-agent, it will read the content of its `agent.py` file.
    -   The endpoint will return a JSON object with the following structure:
        ```json
        {
          "main_agent": {
            "name": "main_agent_name",
            "code": "..."
          },
          "sub_agents": [
            {
              "name": "sub_agent_1_name",
              "code": "..."
            },
            {
              "name": "sub_agent_2_name",
              "code": "..."
            }
          ]
        }
        ```

## Frontend Changes

1.  **Modify `frontend/src/components/CodeViewerModal.tsx`:**
    -   Update the function that fetches the agent code to call the new `/api/agents/{agent_name}/code_with_subagents` endpoint.
    -   Instead of just receiving plain text, it will now receive the JSON object described above.
2.  **Implement Tabbed View:**
    -   Use a UI library (like a native one if available, or a simple custom component) to create a tabbed interface within the modal.
    -   The first tab will be for the main agent and will display `main_agent.code`.
    -   Dynamically create a new tab for each object in the `sub_agents` array.
    -   The tab label will be the `sub_agent.name`.
    -   The tab content will be a code viewer displaying the `sub_agent.code`.
3.  **Conditional Rendering:**
    -   If the API response indicates no sub-agents are present, the modal should render the code viewer without tabs, just as it does currently. This ensures backward compatibility for agents without sub-agents.

## Agent Discovery Convention

-   Sub-agents for a given agent are expected to be located in a directory named `sub_agents` within the main agent's directory.
-   Each subdirectory inside `sub_agents` is considered a single sub-agent.
-   The main code file for each agent (main and sub-agents) is assumed to be named `agent.py`.
