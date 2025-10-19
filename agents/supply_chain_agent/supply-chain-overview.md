# Supply Chain Agent Overview

This document provides an overview and sample usage for the Supply Chain Agent.

## Agent Capabilities

The **RapidResolve Agent** is a proactive supply chain co-pilot that orchestrates specialist sub-agents. Its goal is to comprehensively respond to supply chain disruption alerts.

When it receives a disruption alert, it performs the following steps:
1.  **Impact Analysis:** It first assesses the scope of the problem, identifying affected orders and calculating the total revenue at risk.
2.  **Solution Research:** It then researches mitigation strategies from an internal corporate knowledge base using Retrieval-Augmented Generation (RAG).
3.  **Synthesis:** Finally, it synthesizes all the information into a single, clear, actionable recommendation for the user.

## Sample Disruption Scenario

This scenario demonstrates the agent's ability to handle a complex, multi-step task.

### 1. Triggering the Agent

A user (or an automated monitoring system) sends an alert to the agent.

**Example Prompt:**
> "High-priority alert: Port of Shanghai is closed for the next 48 hours due to a typhoon. Additionally, we've received a notice that Supplier ABC is experiencing a 3-day production delay for component parts."

### 2. Agent's Response

The RapidResolve agent will take the input and orchestrate its sub-agents to produce a comprehensive report.

**Example Agent Output:**

> ### Supply Chain Disruption Analysis
>
> **Alert:** Port of Shanghai is closed for the next 48 hours due to a typhoon. Additionally, we've received a notice that Supplier ABC is experiencing a 3-day production delay for component parts.
>
> ---
>
> ### **Phase 1: Impact Assessment**
>
> I have analyzed the potential impact of the disruption.
>
> *   **Affected SKUs:** 8675 (ProductX)
> *   **Number of Affected Orders:** 42
> *   **Total Revenue at Risk:** $1,250,000.00
>
> ---
>
> ### **Phase 2: Solution Research**
>
> I have researched mitigation strategies from our corporate knowledge base.
>
> *   **For Port Closures:** We can re-route shipments through the nearby Port of Ningbo. This typically adds 1-2 days of transit time and incurs a 5% surcharge.
> *   **For Supplier Delays:** We have an alternative, pre-vetted supplier, "Supplier XYZ," who can provide the necessary components. Their pricing is 10% higher, but they can air-freight the parts to meet our production schedule.
>
> ---
>
> ### **Phase 3: Final Recommendation**
>
> Based on my analysis, I recommend the following course of action:
>
> 1.  **Immediately** contact our logistics partner to re-route all Shanghai-bound shipments to the Port of Ningbo.
> 2.  **Simultaneously,** place a purchase order with Supplier XYZ for the required components and authorize air freight to prevent a production slowdown.
>
> Executing this plan will mitigate the disruption, with an estimated additional cost of $85,000 and a potential delivery delay of 1-2 days. This is preferable to the $1.25M revenue loss from inaction.
>
> *Sources: alternate_ports.txt, supplier_contingency_plans.md*
