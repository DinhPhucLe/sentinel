<div align="center">

# SENTINEL

### Autonomous Orbital Traffic Control

<br>

**5 AI agents. Real-time negotiation. Zero human delay.**

An autonomous multi-agent system that detects satellite collision risks and coordinates avoidance maneuvers in real-time — the air traffic control layer space is missing.

<br>

<img src="https://img.shields.io/badge/Python-3.11+-3776AB?style=flat&logo=python&logoColor=white" />
<img src="https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white" />
<img src="https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=black" />
<img src="https://img.shields.io/badge/Three.js-000000?style=flat&logo=threedotjs&logoColor=white" />
<img src="https://img.shields.io/badge/Claude-Anthropic-191919?style=flat" />
<img src="https://img.shields.io/badge/Google_ADK-4285F4?style=flat&logo=google&logoColor=white" />
<img src="https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white" />
<img src="https://img.shields.io/badge/WebSocket-Live-brightgreen?style=flat" />
<img src="https://img.shields.io/badge/License-MIT-yellow?style=flat" />

</div>

---

## The Problem

> **65,000+** objects orbit Earth. **12,000+** near-misses happen every year. When two satellites are on a collision course, operators today coordinate via **email and phone calls**. That process takes hours — sometimes longer than the time to impact.

SENTINEL replaces that with an autonomous AI pipeline that detects, reasons, negotiates, and validates avoidance maneuvers in seconds.

## How It Works

```
  Conjunction Detected
         │
         ▼
  ┌─────────────┐     ┌──────────────┐     ┌───────────────┐
  │  TRACKING    │────▶│  PREDICTION  │────▶│ OPTIMIZATION  │
  │  Assess      │     │  Risk &      │     │  Simulate 3   │
  │  urgency     │     │  cascade     │     │  maneuver     │
  └─────────────┘     └──────────────┘     │  options      │
                                            └───────┬───────┘
                                                    │
                                                    ▼
                       ┌──────────────┐     ┌───────────────┐
                       │  GOVERNANCE  │◀────│  NEGOTIATION  │
                       │  Validate    │     │  Which sat    │
                       │  safety      │     │  moves?       │
                       └──────┬───────┘     └───────────────┘
                              │
                              ▼
                     Maneuver Approved ✓
```

Each agent is powered by an LLM (Claude / Groq / Ollama — configurable) via Google ADK, with **deterministic orbital math** handled separately in a pure-Python physics layer. Agents reason and decide; they never compute trajectories.

## Features

- **Real-time 3D globe** — Three.js visualization of 29,000+ tracked objects with orbital shells, conjunction lines, and maneuver arcs
- **Live agent reasoning** — watch each agent think in real-time via WebSocket streaming with typewriter animations
- **Multi-operator negotiation** — the Negotiation Agent applies operator policy (GPS never maneuvers unless forced) to decide who moves
- **Governance safety gate** — hard constraints (miss distance > 5km, fuel < 30%, only controllable objects) must pass before any maneuver executes
- **Auto-retry escalation** — if governance rejects, the pipeline automatically retries with alternative approaches up to 3 times
- **AI chat assistant** — embedded Sentinel AI with full orbital context for operator Q&A
- **Real orbital data** — ETL pipeline pulls live TLE data from Space-Track.org

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- API key: `ANTHROPIC_API_KEY` or `GROQ_API_KEY`

### Run locally

```bash
# Clone
git clone https://github.com/DinhPhucLe/sentinel.git
cd sentinel

# Backend
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` — click **LAUNCH MISSION CONTROL**.

### Run with Docker

```bash
docker-compose up
```

### Configure the AI model

Set `AGENT_MODEL` in `.env` to switch providers:

```env
# Anthropic (default)
AGENT_MODEL=anthropic/claude-sonnet-4-6
ANTHROPIC_API_KEY=sk-ant-...

# Groq (fast, free tier)
AGENT_MODEL=groq/llama-3.3-70b-versatile
GROQ_API_KEY=gsk_...

# Local Ollama (no key needed)
AGENT_MODEL=ollama/llama3
```

## Project Structure

```
sentinel/
├── backend/
│   ├── main.py                 # FastAPI server, WebSocket, REST endpoints
│   ├── config.py               # Model config, governance limits
│   ├── models.py               # Dataclasses (Satellite, ConjunctionEvent)
│   ├── agents/
│   │   ├── orchestrator.py     # Sequential pipeline with retry logic
│   │   ├── tracking_agent.py   # Urgency assessment
│   │   ├── prediction_agent.py # Risk contextualization
│   │   ├── optimization_agent.py # Maneuver simulation
│   │   ├── negotiation_agent.py  # Cross-operator decision
│   │   └── governance_agent.py   # Safety validation
│   └── tools/
│       ├── orbital_sim.py      # Pure-Python orbital math (no LLM)
│       └── real_data_loader.py # Space-Track.org data integration
├── frontend/
│   ├── src/
│   │   ├── App.jsx             # Sidebar navigation, view routing
│   │   ├── components/
│   │   │   ├── OrbitCanvas.jsx # Three.js 3D globe + orbits
│   │   │   ├── AgentLog.jsx    # Live agent reasoning with typewriter
│   │   │   ├── MissionPanel.jsx # Controls + decision display
│   │   │   ├── TriageTable.jsx # Conjunction event table
│   │   │   ├── LandingPage.jsx # Cinematic landing with video bg
│   │   │   └── SentinelLogo.jsx # Animated SVG logo
│   │   └── hooks/
│   │       └── useSimulation.js # WebSocket + API state management
│   └── public/                 # Video, logo assets
├── data/                       # Orbital data (TLE, conjunctions)
├── docker-compose.yml
└── CLAUDE.md                   # Architecture rules
```

## Architecture Rules

| Layer | Location | Rule |
|---|---|---|
| **Deterministic** | `tools/` | Pure math. No LLM imports. Returns floats/dataclasses. |
| **Agent** | `agents/` | LLM reasoning only. Never computes numbers. |
| **Orchestrator** | `orchestrator.py` | Agents never call each other — all state flows through the pipeline. |

## Governance Constraints

| Rule | Threshold |
|---|---|
| Post-maneuver miss distance | > 5.0 km |
| Fuel cost per maneuver | < 30% of remaining |
| Controllability | Only controllable satellites can execute burns |
| Operator policy | GPS (P1) never maneuvers unless no alternative exists |

## Data Pipeline

SENTINEL includes an ETL pipeline for real orbital data from Space-Track.org:

```bash
python etl_pipeline.py              # Download + process (existing files)
python etl_pipeline.py --all-files  # Full download
python scheduler.py --run-now       # Start recurring updates
```

## License

MIT License — Phuc Le, 2026

---

<div align="center">
<sub>Built for HackUSF 2025</sub>
</div>
