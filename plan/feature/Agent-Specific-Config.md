# Agent-specific Configuration

## Problem

Currently, agent-specific configuration, such as the environment variables required for the RAG agent to use Vertex AI, is handled by a hardcoded shim in the `agent_runner.py` script. This approach is not scalable, maintainable, or transparent. Any new agent with unique requirements would require modifying the core backend logic.

## Proposal

To address this, we will implement a centralized, host-level configuration system that allows for defining environment variables and other settings on a per-agent basis. This keeps agent-specific setup out of the core application logic and provides a clear, editable file for managing these configurations.

### Key Requirements

1.  **Centralized Configuration:** A single file at the project root will manage configurations for all agents.
2.  **Host-Level Concern:** The configuration will be managed by the host application (the Agent Gallery backend), not stored within the individual agent directories.
3.  **YAML Format:** The configuration file will use YAML for its superior readability and support for comments.
4.  **Dynamic Environment Preparation:** The `AgentRunner` will be responsible for reading this configuration and preparing the agent's subprocess environment before launch.
5.  **Eliminate Hardcoded Shims:** The new system will completely replace the temporary `_prepare_rag_environment` method in `agent_runner.py`.

### Implementation Plan

1.  **Create `agents.config.yaml`:**
    -   A new file named `agents.config.yaml` will be created in the project root.
    -   It will be structured to allow defining an `environment` block for each agent by name.
    -   The initial configuration for the `RAG` agent will be added as the first entry.

    **Example `agents.config.yaml`:**
    ```yaml
    # Centralized configuration for agents hosted by the gallery.
    agents:
      RAG:
        description: "Uses Vertex AI and requires specific GCP project and location."
        environment:
          # Use Vertex AI instead of API Keys
          GOOGLE_GENAI_USE_VERTEXAI: TRUE
          # Unset API keys to force Application Default Credentials
          UNSET_ENV_VARS:
            - GOOGLE_API_KEY
            - GEMINI_API_KEY
          # Project and Location for Vertex AI
          GOOGLE_CLOUD_PROJECT: "primaryproject-305315"
          GOOGLE_CLOUD_LOCATION: "us-central1"
          # Agent-specific values
          RAG_CORPUS: "projects/primaryproject-305315/locations/us-central1/ragCorpora/5685794529555251200"

      some-other-agent:
        environment:
          SOME_CUSTOM_VARIABLE: "value"
    ```

2.  **Update `AgentRunner`:**
    -   Modify the `AgentRunner.start` method to read and parse the `agents.config.yaml` file.
    -   Before starting the subprocess, it will check if a configuration exists for the `agent_name`.
    -   If a configuration is found, it will iterate through the `environment` settings, setting new variables and unsetting specified variables (like `GOOGLE_API_KEY`) in the `env` dictionary that will be passed to the subprocess.
    -   The existing `_prepare_rag_environment` method will be removed.

3.  **Dependencies:**
    -   The `PyYAML` library will need to be added to the backend's `requirements.txt` to handle YAML parsing.

## Effort Assessment

-   **Effort:** FEATURE
-   **Complexity:** Low. The logic is straightforward and contained within the `agent_runner.py` script. It requires adding a new dependency and file parsing, but does not require major architectural changes.
