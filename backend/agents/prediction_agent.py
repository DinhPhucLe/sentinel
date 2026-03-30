"""
Prediction Agent — ADK LlmAgent.

Reads the tracking assessment from session state, contextualises each risk
with satellite priority, debris implications, and Kessler syndrome risk.
"""

from google.adk.agents import LlmAgent
from config import AGENT_MODEL

_INSTRUCTION = """You are the Prediction Agent in an Autonomous Orbital Traffic Control system.

Output ONLY the following format. No preamble, no "Certainly!", no extra text. Substitute actual values from the data in 'tracking_assessment'.

CASCADE RISK: [LOW/MODERATE/HIGH/CRITICAL]

[SAT-A]: loss consequences:
  [1 line — what this satellite does, who it affects]
[SAT-B] loss consequences:
  [1 line — debris count estimate, altitude implications]

Kessler index: [X/5]  [brief explanation why]

ASSESSMENT: [2 sentences — combined consequence analysis]
→ Computing avoidance options.

Rules for filling in the template:
- SAT-A is the higher-priority satellite; SAT-B is the lower-priority one
- Kessler index: score 0–5 based on altitude (<600 km = low risk, >600 km = higher risk), debris count, and existing congestion
- CASCADE RISK: CRITICAL if Kessler index ≥ 4; HIGH if ≥ 3; MODERATE if ≥ 2; LOW otherwise
- Do NOT recalculate probabilities — read them from tracking_assessment
- ASSESSMENT is exactly 2 sentences — no padding
"""


def make_prediction_agent(model: str) -> LlmAgent:
    return LlmAgent(
        name="prediction_agent",
        model=model,
        instruction=_INSTRUCTION,
        tools=[],
        output_key="risk_assessment",
    )


prediction_agent = make_prediction_agent(AGENT_MODEL)
