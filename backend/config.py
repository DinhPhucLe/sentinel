import os

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

# Set AGENT_MODEL env var to switch providers:
#   anthropic/claude-sonnet-4-6  (default — uses your ANTHROPIC_API_KEY)
#   groq/llama-3.3-70b-versatile (needs GROQ_API_KEY)
#   ollama/llama3                (local Ollama, no key needed)
#   gemini-2.0-flash             (needs GOOGLE_API_KEY)
AGENT_MODEL = os.environ.get("AGENT_MODEL", "anthropic/claude-sonnet-4-6")
FALLBACK_MODEL = os.environ.get("FALLBACK_MODEL", "anthropic/claude-sonnet-4-6")

# WebSocket message types
WS_MSG_AGENT = "agent_log"
WS_MSG_DECISION = "decision"
WS_MSG_STATUS = "status"
WS_MSG_ERROR = "error"

# Governance hard limits
MIN_SAFE_MISS_DISTANCE_KM = 5.0
MAX_FUEL_COST_FRACTION = 0.30
