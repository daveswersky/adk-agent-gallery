# Final Plan: "Proactive Supply Chain Analyst Agent" (ADK CLI-centric)

This plan is structured around `LlmAgent` definitions that will be invoked for the demos using the official `adk run` command-line tool.

---

### **Phase 1: Foundational Setup & Data Generation**

This phase is unchanged. The file structure and sample data are still required.

**1. Directory Structure & Data:**
```
supply-chain-agent/
├── main.py
├── requirements.txt
├── .env
├── data/
│   ├── inventory.csv
│   ├── orders.csv
│   └── knowledge_base/
│       ├── Contingency_Playbook.txt
│       ├── Supplier_Contracts.txt
│       └── Historical_Shipment_Data.csv
└── tools/
    ├── __init__.py
    ├── impact_assessment.py
    └── solution_research.py
```

**2. `requirements.txt`:**
```
google-adk
google-generativeai
```

--- 

### **Phase 2: Demo 1 - "RapidResolve" Proactive Agent**

**1. Tool Implementation:**
- The tools will be simple, importable Python functions:
  - `tools/impact_assessment.py`: Defines `calculate_impact(...)`
  - `tools/solution_research.py`: Defines `research_solutions(...)` (our RAG tool)

**2. Agent Implementation (`main.py`):**
- The agent will be a global `LlmAgent` instance for CLI discovery.
```python
# In main.py
from google.adk.agents import LlmAgent # Assuming namespace
from tools.impact_assessment import calculate_impact
from tools.solution_research import research_solutions

rapid_resolve_agent = LlmAgent(
    prompt="""
        You are the RapidResolve Agent, a proactive supply chain co-pilot.
        When you receive a disruption alert, your goal is to:
        1. Use the impact_assessment tool to understand the scope of the problem.
        2. Use the solution_research tool to find mitigation strategies from the knowledge base.
        3. Synthesize your findings into a clear, actionable recommendation.
    """,
    tools=[
        calculate_impact,
        research_solutions
    ]
)
```

**3. Demo Execution (Corrected Command):**
- Invoke the agent via the CLI:
  ```bash
  adk run main:rapid_resolve_agent
  ```
- Provide the disruption alert as the first input.

--- 

### **Phase 3: Demo 2 - The RAG "Corporate Brain"**

**1. Agent Definitions (`main.py`):**
- An additional, tool-less `ungrounded_agent` will be defined in the same file.
```python
# In main.py (additions)

# ... (rapid_resolve_agent definition from above)

# A simple agent with no tools or special knowledge for comparison
ungrounded_agent = LlmAgent(
    prompt="You are a helpful assistant."
)
```

**2. Demo Execution (Corrected Commands):**
- **Step 1 (Ungrounded):**
  - Run the ungrounded agent from the terminal:
    ```bash
    adk run main:ungrounded_agent
    ```
  - Ask the question: `"What is our standard procedure if the Port of Shanghai closes?"`
  - Observe the generic, unhelpful response.

- **Step 2 (Grounded):**
  - Exit the previous session and run the main, tool-equipped agent:
    ```bash
    adk run main:rapid_resolve_agent
    ```
  - Ask the same question: `"What is our standard procedure if the Port of Shanghai closes?"`
  - Observe the agent invoking the `solution_research` tool and providing a precise, sourced answer from the knowledge base.
