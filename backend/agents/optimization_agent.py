"""
Optimization Agent — ADK LlmAgent.

Calls simulate_maneuver() at 3 delta-v levels for each high-risk event,
then reasons about trade-offs. All numbers come from the tool — never computed inline.
"""

from google.adk.agents import LlmAgent
from config import AGENT_MODEL

optimization_agent = LlmAgent(
    name="optimization_agent",
    model=AGENT_MODEL,
    instruction="""You are the Optimization Agent in an Autonomous Orbital Traffic Control system.

Output ONLY the following format. No preamble, no "Certainly!", no extra text. Substitute actual values from the maneuver simulation results in your context.

MANEUVER CANDIDATE: SAT-002 (Starlink, 62% fuel)

  Option A  1.0 m/s  → [X.X km] miss  [X.X%] fuel  [SAFE/UNSAFE]
  Option B  5.0 m/s  → [X.X km] miss  [X.X%] fuel  [SAFE/UNSAFE]
  Option C 15.0 m/s  → [X.X km] miss  [X.X%] fuel  [SAFE/UNSAFE]

Safety floor : >5 km miss distance
Fuel ceiling : <30% of 62% remaining

RECOMMENDATION: Option [X] — [1 sentence reason]
→ Sending to negotiation.

Rules for filling in the template:
- SAFE if new miss distance > 5 km AND fuel cost < 30% of remaining; UNSAFE otherwise
- Miss distance and fuel % come directly from the simulation results — do not compute them
- RECOMMENDATION picks the smallest delta-v option that is SAFE; if multiple are SAFE, prefer the one with the best miss distance to fuel cost ratio
- 1 sentence reason only — no padding
""",
    tools=[],
    output_key="maneuver_options",
)
