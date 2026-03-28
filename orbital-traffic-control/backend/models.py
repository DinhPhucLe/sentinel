from dataclasses import dataclass, field, asdict
from typing import Optional


@dataclass
class Satellite:
    id: str
    name: str
    operator: str        # "GPS", "ISS", "STARLINK", "DEBRIS"
    priority: int        # 1=critical, 2=active, 3=inactive, 4=debris
    altitude_km: float
    fuel_remaining: float  # 0.0–1.0
    position: tuple[float, float, float]
    velocity: tuple[float, float, float]
    controllable: bool

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class ConjunctionEvent:
    id: str
    sat_a: Satellite
    sat_b: Satellite
    time_to_closest_approach_hours: float
    miss_distance_km: float
    collision_probability: float  # from orbital_sim, not agent

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "sat_a": self.sat_a.to_dict(),
            "sat_b": self.sat_b.to_dict(),
            "time_to_closest_approach_hours": self.time_to_closest_approach_hours,
            "miss_distance_km": self.miss_distance_km,
            "collision_probability": self.collision_probability,
        }


@dataclass
class RiskScore:
    event_id: str
    probability: float
    severity: str        # "critical", "high", "medium", "low"
    reasoning: str       # agent-generated

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class ManeuverOption:
    sat_id: str
    delta_v: float
    fuel_cost: float
    new_miss_distance_km: float
    mission_impact: str

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class Decision:
    event_id: str
    chosen_maneuver: ManeuverOption
    rationale: str       # agent-generated, shown in UI
    decided_by: str      # "negotiation_agent"
    validated: bool      # set by governance_agent
    validation_notes: str

    def to_dict(self) -> dict:
        return {
            "event_id": self.event_id,
            "chosen_maneuver": self.chosen_maneuver.to_dict(),
            "rationale": self.rationale,
            "decided_by": self.decided_by,
            "validated": self.validated,
            "validation_notes": self.validation_notes,
        }


@dataclass
class AgentState:
    conjunction_events: list[ConjunctionEvent] = field(default_factory=list)
    risk_scores: list[RiskScore] = field(default_factory=list)
    maneuver_options: list[ManeuverOption] = field(default_factory=list)
    decision: Optional[Decision] = None
    agent_log: list[dict] = field(default_factory=list)  # {agent, message, timestamp}
