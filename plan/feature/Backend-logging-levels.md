# Feature: Backend Logging Levels

**Summary:** This feature replaces the current `print()` statements in the backend with Python's standard `logging` module. This will allow the log verbosity to be configured, improving the debugging and operational experience.

---

### User Stories

-   **Story 1:** As a developer running the gallery locally, I want to be able to set the log level to `DEBUG` to see detailed operational messages for troubleshooting.
-   **Story 2:** As an operator running the gallery in a production-like environment, I want to set the log level to `INFO` or `WARNING` to reduce noise and focus on important events.

### Implementation Plan

#### Backend

-   **Task: Replace `print()` with `logging`.**
    -   Go through all Python files in the `backend/` directory (`main.py`, `agent_runner.py`, etc.).
    -   In each file, get a logger instance: `logger = logging.getLogger(__name__)`.
    -   Replace all `print()` calls with the appropriate logger method (`logger.info()`, `logger.debug()`, `logger.error()`).
        -   `print("--- DEBUG: ...")` becomes `logger.debug(...)`
        -   `print("Server shutting down...")` becomes `logger.info(...)`
        -   Error messages in `except` blocks become `logger.error(...)` or `logger.exception(...)`.

-   **Task: Configure Logging Level.**
    -   In `backend/main.py`, at the application startup, configure the root logger.
    -   Read the desired log level from an environment variable (e.g., `LOG_LEVEL`, defaulting to `INFO`).
    -   Use `logging.basicConfig()` to set the level and a standard format for the log messages.
    -   Ensure the Uvicorn server's log level is also configured to respect this setting, which can be done via its own configuration.

-   **Task: Update "How to Run" Documentation.**
    -   Update the `README.md` to include instructions on how to set the `LOG_LEVEL` environment variable when running the backend.
