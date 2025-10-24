# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.12.0] - 2025-10-24

### Added

- **A2A Support Epic:** Implemented a dual-runner backend architecture to support both ADK and self-hosted A2A agents. Refactored the frontend session management to handle different agent types.

### Fixed

- Resolved a test failure in the event streaming plugin by correcting the event structure and suppressing events for `AgentTool`.

## [0.11.0] - 2025-10-19

### Added

- Grouped agent list in the sidebar based on `gallery.config.yaml`.
- A dynamic "Running Agents" group that appears when agents are active.
- A confirmation warning when the user attempts to refresh the browser with active agents.

### Fixed

- Agent group ordering now respects the order defined in the configuration file.

## [0.10.0] - 2025-10-15

### Added

- Playwright configuration for end-to-end testing.

## [0.9.0] - 2025-10-14

### Added

- Updated development workflow and planning docs.

## [0.8.0] - 2025-10-14

### Added

- Real-time event streaming via WebSockets.

## [0.7.0] - 2025-10-14

### Added

- Pipe-based IPC for event streaming.

## [0.6.0] - 2025-10-12

### Added

- Completed Phase 1 of backend rearchitecture.

## [0.5.0] - 2025-10-08

### Added

- New programmatic agent runner design.

## [0.4.0] - 2025-10-08

### Added

- "Stop All" functionality.

## [0.3.0] - 2025-09-29

### Added

- Persistent chat sessions and improved server stability.

## [0.2.0] - 2025-09-29

### Added

- Agent listing and submodule support.

## [0.1.0] - 2025-09-28

### Added

- Initial version of the Agent Gallery.
