# Planning History for Supply Chain Agent

This document records the evolution of the implementation plan for the "Proactive Supply Chain Analyst Agent" based on user feedback and corrections.

---

## Version 1: Initial Implementation Plan

*Generated after the initial request to build the first two demos from `supply-chain-sample.md`.*

This plan outlined the basic components, data structures, and a three-phase approach. It correctly identified the need for tools and sample data but made general assumptions about the agent's implementation.

**Key Features:**
- **Phase 1: Setup & Data Generation:** Proposed file structure and sample CSV/text files.
- **Phase 2: Proactive Agent:** Described an agent using `impact_assessment` and `solution_research` tools.
- **Phase 3: RAG Demo:** Proposed a side-by-side comparison of a grounded vs. ungrounded model.
- **Technology:** Assumed a generic "ADK" implementation without specific APIs.

---

## Version 2: ADK-centric Plan

*Generated after user feedback to incorporate ADK namespaces and APIs more explicitly. This version contained hallucinated namespaces.*

This revision attempted to map the initial plan to specific, but incorrect, ADK classes and decorators.

**Key Changes & Errors:**
- **Tool Implementation:** Incorrectly proposed using a `@tool` decorator from a non-existent `google.adk.tools` module.
- **Agent Implementation:** Incorrectly proposed using an `Agent` class from a non-existent `google.adk.core` module.
- **Execution:** Correctly identified the need for a `Runner` but referenced event classes from the non-existent `google.adk.core.events` module.

---

## Version 3: Corrected ADK Plan (2.0)

*Generated after the user corrected the hallucinated namespaces and a Google search was performed to find the correct APIs. This version used a programmatic `Runner`.*

This version represented a major correction, aligning the plan with the actual structure of the ADK based on documentation. It centered on a callable agent function and a programmatic `Runner`.

**Key Changes:**
- **Corrected Namespaces:** Referenced `google.adk.core.Inference`, `google.adk.core.prompt`, `google.adk.runners.Runner`, and `google.adk.sessions.Session`.
- **Agent Definition:** Redefined the agent as a Python function decorated with `@prompt.from_template`, which was correct.
- **Execution Model:** The plan was built around programmatically using `Runner.run_async()` and passing `google.genai.types.Content` objects, which is a valid way to use the ADK.

---

## Version 4: Final CLI-centric Plan

*Generated after user feedback to remove the `Runner` and design the implementation around the ADK CLI and `LlmAgent` definitions. This is the final, approved plan.*

This final revision simplified the execution model to align with the user's goal of using the ADK's command-line interface directly.

### **Final Plan: "Proactive Supply Chain Analyst Agent" (ADK CLI-centric)**

This plan is structured around `LlmAgent` definitions that will be invoked for the demos using the official `adk run` command-line tool.

--- 

### **Phase 1: Foundational Setup & Data Generation**

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
    prompt="You are the RapidResolve Agent...",
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
ungrounded_agent = LlmAgent(
    prompt="You are a helpful assistant."
)
```

**2. Demo Execution (Corrected Commands):**
- **Step 1 (Ungrounded):** Run `adk run main:ungrounded_agent` and ask the target question.
- **Step 2 (Grounded):** Run `adk run main:rapid_resolve_agent` and ask the same question to see the tool-powered, sourced response.
