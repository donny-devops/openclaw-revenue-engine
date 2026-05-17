from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class AgentTask:
    agent: str
    objective: str
    required_review: bool = True


def load_registry() -> dict[str, Any]:
    registry_path = REPO_ROOT / "config" / "agentic-ai.json"
    return json.loads(registry_path.read_text(encoding="utf-8"))


def plan_request(customer_request: str) -> list[AgentTask]:
    registry = load_registry()
    enabled_agents = [agent for agent in registry["agents"] if agent.get("enabled")]

    tasks = [
        AgentTask(
            agent="revenue-intake-orchestrator",
            objective="Classify the request into a Moltgate lane and service.",
        )
    ]

    lowered = customer_request.lower()
    if any(term in lowered for term in ("ci", "workflow", "debug", "error", "test")):
        tasks.append(
            AgentTask(
                agent="swe-remediation-agent",
                objective="Draft root cause, patch plan, validation steps, and pull request summary.",
            )
        )

    if any(term in lowered for term in ("image", "screenshot", "pdf", "document", "log")):
        tasks.append(
            AgentTask(
                agent="multimodal-evidence-agent",
                objective="Summarize evidence and identify risk flags for operator review.",
            )
        )

    tasks.append(
        AgentTask(
            agent="quality-guardrail-agent",
            objective="Review draft output for secrets, unsafe automation, and scope creep.",
        )
    )

    valid_agents = {agent["slug"] for agent in enabled_agents}
    return [task for task in tasks if task.agent in valid_agents]


if __name__ == "__main__":
    demo = "Debug my GitHub Actions workflow and produce a paid Moltgate delivery summary."
    print(json.dumps([task.__dict__ for task in plan_request(demo)], indent=2))
