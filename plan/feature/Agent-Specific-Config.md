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

## Revisions from Code Review

Based on feedback from the initial pull request, the following changes are required to address security, robustness, and correctness concerns.

### 1. Avoid Hardcoded Secrets

-   **Problem:** The `agents.config.yaml` file contains sensitive project IDs and corpus paths.
-   **Action:**
    -   Rename the existing file to `agents.config.yaml.example` to serve as a template.
    -   Replace the hardcoded values in the example file with placeholder environment variables (e.g., `GOOGLE_CLOUD_PROJECT: "${GCP_PROJECT_ID}"`).
    -   Add `agents.config.yaml` to the `.gitignore` file to prevent accidental commits of user-specific configurations.

### 2. Correct `requirements.txt`

-   **Problem:** The `PyYAML` dependency was appended to the same line as `google-adk`, which would cause installation to fail.
-   **Action:**
    -   Modify `backend/requirements.txt` to place `PyYAML==6.0.1` on its own line.

### 3. Ensure Correct YAML String Parsing

-   **Problem:** The YAML value `TRUE` is parsed as a boolean (`True`) by PyYAML, which is then converted to the string `"True"`, not `"TRUE"`.
-   **Action:**
    -   In `agents.config.yaml.example`, enclose the value in quotes (`"TRUE"`) to ensure it is parsed as a string.

### 4. Add Robust Error Handling

-   **Problem:** A malformed `agents.config.yaml` file will crash the backend during agent startup.
-   **Action:**
    -   In `backend/agent_runner.py`, wrap the `yaml.safe_load()` call in a `try...except yaml.YAMLError` block.
    -   If an error occurs, log a warning message and continue with an empty configuration, preventing a crash.

### 5. Robust Configuration Path

-   **Problem:** The path to `agents.config.yaml` is resolved relative to the current working directory, which can be unreliable.
-   **Action:**
    -   In `backend/agent_runner.py`, modify the path construction to be relative to the script's own location, ensuring it can be found regardless of where the application is launched from.
    -   The path should be: `os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'agents.config.yaml'))`.
