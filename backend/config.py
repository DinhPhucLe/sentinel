import os

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
CLAUDE_MODEL = "claude-sonnet-4-6"

# WebSocket message types
WS_MSG_AGENT = "agent_log"
WS_MSG_DECISION = "decision"
WS_MSG_STATUS = "status"
WS_MSG_ERROR = "error"

# Governance hard limits
MIN_SAFE_MISS_DISTANCE_KM = 5.0
MAX_FUEL_COST_FRACTION = 0.30
