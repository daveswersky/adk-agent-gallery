# Known Bugs

- Some agents get a 404 error when opening the code view.
- Backend server throws `AttributeError: 'dict' object has no attribute 'stop'` on reload. (RESOLVED)
- ~~RAG ADK sample not working~~
- Viewer showing [ERROR] for regular output
- The `agent_host.py` script required an agent-specific shim to handle the unique authentication and configuration needs of the RAG sample agent (which requires Vertex AI and OAuth2 credentials). The current system lacks a mechanism for defining agent-specific environment variables or configurations, forcing temporary hardcoded changes in the generic agent runner. This should be replaced with a robust, agent-specific configuration system.
- Viewer reports both API keys set for RAG agent when no keys are set
- need to increase response timeout for long-running requests, like marketing-agency
- Log type errors: 
  - [academic-research] [ERROR] Both GOOGLE_API_KEY and GEMINI_API_KEY are set. Using GOOGLE_API_KEY.
  - [financial-advisor] [PIP_ERROR] + watchdog==6.0.0
- ChatInterface doesn't clear on agent server stop/start
  - REPRO: 
    - Start blog agent, query
    - Stop agent
    - start agent
- **CRITICAL BUG: ChatInterface cross-posts results when switching between agents**
  - REPRO: Run a server while another is working on the response for a turn, swap between them

- **E2E tests are failing.**
  - The `Full agent lifecycle UI test` in `frontend/e2e/app.spec.ts` is consistently failing with a `Cannot navigate to invalid URL` error.
  - This indicates that the Playwright `webServer` is not starting the Vite development server correctly. Recent refactoring of the frontend into its own directory is the likely cause.
  - The `playwright.config.ts` and `vite.config.ts` files need to be reconciled to ensure the test server can be launched from the correct directory.
