# Agent Subagent Implementation Analysis

This document analyzes and categorizes agents based on how they implement subagent relationships. The key distinction is between "true" subagent delegation, where an agent orchestrates other agents via the `sub_agents` parameter, and using `AgentTool`, where a subagent is wrapped and used like any other tool.

## Agents with True Subagent Delegation

These agents use the `sub_agents` parameter to orchestrate other agents in a hierarchical or sequential manner. This is considered a "true" subagent implementation.

-   **`adk-samples/python/agents/auto-insurance-agent`**: The root agent's `sub_agents` list includes `membership_agent`, `roadside_agent`, `claims_agent`, and `rewards_agent`.
-   **`adk-samples/python/agents/blog-writer`**: The `interactive_blogger_agent` uses `robust_blog_writer`, `robust_blog_planner`, `blog_editor`, and `social_media_writer` in its `sub_agents` list.
-   **`adk-samples/python/agents/brand-search-optimization`**: The root agent includes `keyword_finding_agent`, `search_results_agent`, and `comparison_root_agent` in its `sub_agents` list.
-   **`adk-samples/python/agents/camel`**: This agent uses a `LoopAgent` which contains `pllm_agent` and `camel_interpreter_agent` as sub-agents.
-   **`adk-samples/python/agents/data-science`**: The root agent includes `bqml_agent` in its `sub_agents` list.
-   **`adk-samples/python/agents/fomc-research`**: The root agent's `sub_agents` list contains `RetrieveMeetingDataAgent`, `ResearchAgent`, and `AnalysisAgent`.
-   **`adk-samples/python/agents/gemini-fullstack`**: This agent uses a `SequentialAgent` named `research_pipeline` which in turn contains a `LoopAgent` with more sub-agents.
-   **`adk-samples/python/agents/google-trends-agent`**: This is a `SequentialAgent` that runs `trends_query_generator_agent` and `trends_query_executor_agent` as sub-agents.
-   **`adk-samples/python/agents/image-scoring`**: This uses a `LoopAgent` that contains a `SequentialAgent` (`image_generation_scoring_agent`) and a `checker_agent_instance` as sub-agents.
-   **`adk-samples/python/agents/llm-auditor`**: This is a `SequentialAgent` with `critic_agent` and `reviser_agent` as sub-agents.
-   **`adk-samples/python/agents/machine-learning-engineering`**: The root agent has `mle_pipeline_agent` (a `SequentialAgent`) in its `sub_agents` list.
-   **`adk-samples/python/agents/safety-plugins`**: The root agent includes a `sub_agent` in its `sub_agents` list.
-   **`adk-samples/python/agents/travel-concierge`**: The root agent's `sub_agents` list is populated with multiple agents like `inspiration_agent`, `planning_agent`, etc.

## Agents Using `AgentTool`

These agents use `AgentTool` to wrap other agents, effectively treating them as tools. This is a valid, but different, pattern from the direct delegation model.

-   `supply_chain_agent`
-   `adk-samples/python/agents/academic-research`
-   `adk-samples/python/agents/financial-advisor`
-   `adk-samples/python/agents/marketing-agency`
-   `adk-samples/python/agents/medical-pre-authorization`
