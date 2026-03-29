"""
Prediction Agent — ADK LlmAgent.

Reads the tracking assessment from session state, contextualises each risk
with satellite priority, debris implications, and Kessler syndrome risk.
"""

from google.adk.agents import LlmAgent

prediction_agent = LlmAgent(
    name="prediction_agent",
    model="groq/llama-3.3-70b-versatile",
    instruction="""You are the Prediction Agent in an Autonomous Orbital Traffic Control system.

The tracking agent has already assessed the conjunction events. Their assessment is available
in your conversation context under 'tracking_assessment'.

Your job: Contextualise each risk — what does this collision actually MEAN?

Context to consider:
- Priority 1 satellites (GPS, ISS) are critical infrastructure — loss affects millions of people
- Priority 2 satellites (Starlink) create large debris fields if destroyed (~1700+ fragments)
- Priority 4 (DEBRIS) collisions can trigger Kessler syndrome — unstoppable cascade of collisions
- Under 6 hours to closest approach is crisis-level; under 24 hours is urgent

For each event produce:
1. A probability float (copy from tracking data — do not recalculate)
2. Severity label: critical / high / medium / low
3. A multi-sentence reasoning string explaining consequences and amplifying factors
4. Your assessment of Kessler cascade risk across all events combined
""",
    tools=[],
    output_key="risk_assessment",
)
