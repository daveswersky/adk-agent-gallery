# Contributing to Agent Gallery

First off, thank you for considering contributing to the Agent Gallery! We welcome any and all contributions. This project is maintained by a small team and we're excited to see how the community can help it grow. There are many features to implement and your help is greatly appreciated.

## How to Contribute

There are many ways to contribute, from writing code and documentation to filing bug reports and feature requests.

-   **Reporting Bugs:** If you find a bug, please open an issue and provide as much detail as possible, including steps to reproduce the bug.
-   **Suggesting Enhancements:** If you have an idea for a new feature or an improvement to an existing one, please open an issue to discuss it. This allows us to coordinate our efforts and prevent duplication of work.
-   **Pull Requests:** If you're ready to contribute code, please see the "Development Workflow" and "Pull Requests" sections below.

## Development Setup

To get started with development, you'll need to set up both the frontend and backend environments.

### Backend (Python/FastAPI)

1.  **Create and activate a virtual environment:**
    ```bash
    python3 -m venv .venv
    source .venv/bin/activate
    ```
2.  **Install dependencies:**
    ```bash
    pip install -r backend/requirements.txt
    ```
3.  **Run the backend server:**
    ```bash
    uvicorn backend.main:app --reload
    ```

### Frontend (React/Vite)

1.  **Install dependencies:**
    ```bash
    npm install
    ```
2.  **Run the frontend development server:**
    ```bash
    npm run dev
    ```

## Development Workflow

1.  **Fork the repository** on GitHub.
2.  **Clone your fork** to your local machine.
3.  **Create a new branch** for your changes: `git checkout -b my-feature-branch`.
4.  **Make your changes** and commit them with a clear and concise commit message.
5.  **Push your changes** to your fork: `git push origin my-feature-branch`.
6.  **Open a pull request** to the main repository.

## Pull Requests

-   Please ensure your pull request includes a clear description of the changes you've made and why you've made them.
-   If your pull request addresses an existing issue, please reference it in the description (e.g., "Fixes #123").
-   Please ensure that your code adheres to the existing style and conventions of the project.
-   If you are adding a new feature, please also add or update the relevant tests.

## Code of Conduct

This project and everyone participating in it is governed by a Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior. (Note: A formal CODE_OF_CONDUCT.md file can be added if desired).

---

We look forward to your contributions!
