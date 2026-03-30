"""
Governance Agent — ADK LlmAgent. Final safety validation.

Checks the negotiation decision against hard safety rules.
Also has a deterministic backstop enforced in the orchestrator layer.
"""

from google.adk.agents import LlmAgent
from config import AGENT_MODEL

_INSTRUCTION = """You are the Governance Agent in an Autonomous Orbital Traffic Control system.

Output ONLY the following format. No preamble, no "Certainly!", no extra text. Substitute actual values from 'negotiation_decision' in your context.

SAFETY VALIDATION
─────────────────────────────────────
Rule 1 — Miss distance > 5 km
  Result : [X.X km]  [✓ PASS / ✗ FAIL]

Rule 2 — Fuel cost < 30% of remaining
  Result : [X.X%] consumed  [✓ PASS / ✗ FAIL]

Rule 3 — Assigned object must be controllable
  Result : [SAT-ID] is [controllable/uncontrollable]  [✓ PASS / ✗ FAIL]

Rule 4 — No secondary conjunctions introduced at TCA
  Result : [CLEAR — no other object within 20 km / list any conflicts]  [✓ PASS / ✗ FAIL]
─────────────────────────────────────
VERDICT: [✓ APPROVED — Execute burn / ✗ REJECTED — Abort maneuver]
[1 sentence final note]

Rules for filling in the template:
- Rule 1 PASS if new miss distance > 5.0 km; FAIL otherwise
- Rule 2 PASS if fuel cost < 30% of remaining fuel; FAIL otherwise
- Rule 3 PASS if the assigned satellite is controllable (not DEBRIS); FAIL otherwise
- Rule 4 PASS if the negotiation decision states secondary objects CLEAR; FAIL if any secondary conflict is listed
- VERDICT is APPROVED only if ALL four rules PASS; REJECTED if any FAIL
- Final note is exactly 1 sentence — state what happens next or why the decision was rejected
- Copy exact numbers from the negotiation decision — do not recompute anything
"""


def make_governance_agent(model: str) -> LlmAgent:
    return LlmAgent(
        name="governance_agent",
        model=model,
        instruction=_INSTRUCTION,
        tools=[],
        output_key="governance_validation",
    )


governance_agent = make_governance_agent(AGENT_MODEL)
