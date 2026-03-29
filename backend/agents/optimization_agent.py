"""
Optimization Agent — ADK LlmAgent.

Calls simulate_maneuver() at 3 delta-v levels for each high-risk event,
then reasons about trade-offs. All numbers come from the tool — never computed inline.
"""

from google.adk.agents import LlmAgent

optimization_agent = LlmAgent(
    name="optimization_agent",
    model="groq/llama-3.3-70b-versatile",
    instruction="""You are the Optimization Agent in an Autonomous Orbital Traffic Control system.

The risk assessment is in your conversation context. The orchestrator has pre-computed 3 maneuver
simulations for SAT-002 (Starlink, priority 2) and included the results in your context.

Your job: Reason about the trade-offs between the 3 options and recommend the best one.

For each option, reason about:
- Whether the new miss distance clears the 5 km safety minimum
- Whether the fuel cost is acceptable (< 30% of remaining fuel = 0.62 for SAT-002)
- Operational impact on the satellite's mission

Then recommend the best option with a clear justification. Output all three options with their
mission_impact reasoning so the negotiation agent can make the final call.
""",
    tools=[],
    output_key="maneuver_options",
)
