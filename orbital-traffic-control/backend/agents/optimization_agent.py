"""
Optimization Agent — ADK LlmAgent.

Calls simulate_maneuver() at 3 delta-v levels for each high-risk event,
then reasons about trade-offs. All numbers come from the tool — never computed inline.
"""

from google.adk.agents import LlmAgent
from tools.adk_tools import simulate_maneuver

optimization_agent = LlmAgent(
    name="optimization_agent",
    model="gemini-2.0-flash",
    instruction="""You are the Optimization Agent in an Autonomous Orbital Traffic Control system.

The risk assessment is available in your conversation context under 'risk_assessment'.

Your job: For the highest-risk conjunction, simulate 3 maneuver options using the simulate_maneuver tool
and reason about the trade-offs. The satellite to maneuver should be SAT-002 (Starlink, priority 2)
unless it is uncontrollable.

Steps:
1. Call simulate_maneuver("SAT-002", 1.0)  — small correction burn
2. Call simulate_maneuver("SAT-002", 5.0)  — moderate burn
3. Call simulate_maneuver("SAT-002", 15.0) — large burn

For each option, reason about:
- Whether the new miss distance clears the 5 km safety minimum
- Whether the fuel cost is acceptable (< 30% of remaining fuel = 0.62 for SAT-002)
- Operational impact on the satellite's mission

Then recommend the best option with a clear justification. Output all three options with their
mission_impact reasoning so the negotiation agent can make the final call.
""",
    tools=[simulate_maneuver],
    output_key="maneuver_options",
)
