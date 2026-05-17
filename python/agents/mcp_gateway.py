from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class McpCallPlan:
    tenant_id: str
    server: str
    tool: str
    requires_human_approval: bool
    audit_required: bool


def load_gateway_config() -> dict[str, Any]:
    path = REPO_ROOT / "config" / "mcp-gateway.json"
    return json.loads(path.read_text(encoding="utf-8"))


def load_agent_registry() -> dict[str, Any]:
    path = REPO_ROOT / "config" / "agentic-ai.json"
    return json.loads(path.read_text(encoding="utf-8"))


def _server_by_slug(config: dict[str, Any], slug: str) -> dict[str, Any]:
    for server in config["servers"]:
        if server["slug"] == slug and server.get("enabled"):
            return server
    raise ValueError(f"Unknown or disabled MCP server: {slug}")


def plan_mcp_calls(tenant_id: str, agent_slug: str) -> list[McpCallPlan]:
    if not tenant_id.strip():
        raise ValueError("tenant_id is required for MCP gateway planning")

    gateway = load_gateway_config()
    registry = load_agent_registry()
    agents = {agent["slug"]: agent for agent in registry["agents"] if agent.get("enabled")}
    agent = agents.get(agent_slug)
    if agent is None:
        raise ValueError(f"Unknown or disabled agent: {agent_slug}")

    plans: list[McpCallPlan] = []
    for server_slug in agent.get("mcp_servers", []):
        server = _server_by_slug(gateway, server_slug)
        allowed = set(server.get("allowed_tools", []))
        approval_tools = set(server.get("human_approval_required_for", []))

        for tool in agent.get("mcp_tools", []):
            if tool not in allowed:
                continue
            plans.append(
                McpCallPlan(
                    tenant_id=tenant_id,
                    server=server_slug,
                    tool=tool,
                    requires_human_approval=tool in approval_tools,
                    audit_required=bool(gateway["gateway"].get("audit_log", True)),
                )
            )

    return plans


if __name__ == "__main__":
    sample = plan_mcp_calls("tenant_demo", "swe-remediation-agent")
    print(json.dumps([plan.__dict__ for plan in sample], indent=2))
