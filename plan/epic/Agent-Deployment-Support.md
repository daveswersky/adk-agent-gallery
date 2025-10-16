# Epic: Agent Deployment Support

**Summary:** This epic expands the Agent Gallery from a local development tool into a deployment portal, allowing users to deploy agents directly to cloud platforms like Google Cloud Run.

**Key Challenges:**
-   **Cloud Authentication:** The backend needs to securely handle Google Cloud credentials.
-   **Packaging & Containerization:** Agents must be packaged into container images before deployment.
-   **Asynchronous Deployment Engine:** The backend needs a non-blocking service to manage long-running deployment tasks.
-   **Real-time Feedback:** The UI must provide live logs and status updates during the deployment process.

---

## Phase 1: Backend Deployment Engine

This phase focuses on building the core backend capabilities required to perform a deployment.

-   **Feature: Agent Packaging Service**
    -   **Story:** As a backend developer, I want a service that can take an agent's source code and package it into a deployable container image.
    -   **Tasks:**
        -   Implement logic to find or generate a `Dockerfile` for a given agent.
        -   Integrate a Docker client library (e.g., `docker-py`) to run `docker build`.
        -   Add logic to tag the image and push it to a container registry (e.g., Google Artifact Registry). This will require handling registry authentication.

-   **Feature: Asynchronous Task Manager for Deployments**
    -   **Story:** As a backend developer, I want to run deployments as background tasks so they don't block the main server.
    -   **Tasks:**
        -   Integrate a simple async task runner (e.g., FastAPI's `BackgroundTasks`).
        -   Create a new service that orchestrates the packaging and deployment steps within a background task.
        -   This service will need to capture `stdout`/`stderr` from the deployment commands.

-   **Feature: Cloud Run Deployment Target**
    -   **Story:** As a backend developer, I want to be able to deploy a container image to Google Cloud Run.
    -   **Tasks:**
        -   Integrate the Google Cloud client library for Python.
        -   Implement a function that uses the library or shells out to `gcloud run deploy` to deploy a specified container image.
        -   Handle Google Cloud authentication using Application Default Credentials (ADC).

## Phase 2: Frontend UI for Deployment

This phase focuses on building the user interface for configuring and monitoring deployments.

-   **Feature: Deployment Configuration UI**
    -   **Story:** As a user, I want a simple form to provide the necessary information to deploy my agent.
    -   **Tasks:**
        -   Add a "Deploy" button to the `AgentListItem` component.
        -   Create a new modal or page with a form for deployment parameters (GCP Project ID, Region, Service Name, etc.).

-   **Feature: Real-time Deployment Log Viewer**
    -   **Story:** As a user, I want to see the live output of the deployment process so I know what's happening.
    -   **Tasks:**
        -   Create a new API endpoint and WebSocket channel for deployment tasks.
        -   The backend's asynchronous task manager will send log lines and status updates through this channel.
        -   Create a new frontend component (e.g., a modal or a dedicated view) to display these real-time logs.

## Phase 3: Additional Deployment Targets

This phase can be parallelized or done later to add more deployment options.

-   **Feature: Agent Engine Deployment Target**
    -   **Story:** As a user, I want the option to deploy my agent to Agent Engine.
    -   **Tasks:**
        -   Research the deployment process and APIs for Agent Engine.
        -   Implement a new deployment function in the backend similar to the Cloud Run one.
        -   Update the frontend UI to allow the user to select "Agent Engine" as a deployment target.
