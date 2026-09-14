import fs from 'fs';
import path from 'path';

export interface AgentDefinition {
  slug: string;
  name: string;
  type: string;
  purpose: string;
  inputs: string[];
  outputs: string[];
  mcp_servers: string[];
  mcp_tools: string[];
  human_review_required: boolean;
  enabled: boolean;
}

export interface AgentCatalog {
  schema_version: string;
  mode: string;
  default_orchestrator: string;
  agents: AgentDefinition[];
}

export interface AgentAssignment {
  slug: string;
  name: string;
  type: string;
  purpose: string;
  human_review_required: boolean;
  mcp_servers: string[];
  mcp_tools: string[];
}

export interface AgentPlan {
  primary: AgentAssignment;
  supporting: AgentAssignment[];
}

const SERVICE_AGENT_MAP: Record<string, string> = {
  'repo-triage': 'swe-remediation-agent',
  'actions-debug': 'swe-remediation-agent',
  'devsecops-hardening': 'compliance-quality-agent',
  'openclaw-setup': 'config-agent',
  'ai-roadmap': 'revenue-intake-orchestrator',
};

let catalogCache: AgentCatalog | undefined;

const toAssignment = (agent: AgentDefinition): AgentAssignment => ({
  slug: agent.slug,
  name: agent.name,
  type: agent.type,
  purpose: agent.purpose,
  human_review_required: agent.human_review_required,
  mcp_servers: [...agent.mcp_servers],
  mcp_tools: [...agent.mcp_tools],
});

export function loadAgentCatalog(): AgentCatalog {
  if (catalogCache) return catalogCache;
  const catalogPath = path.resolve(__dirname, '..', '..', 'config', 'agentic-ai.json');
  catalogCache = JSON.parse(fs.readFileSync(catalogPath, 'utf8')) as AgentCatalog;
  return catalogCache;
}

export function listEnabledAgents(): AgentDefinition[] {
  return loadAgentCatalog().agents.filter((agent) => agent.enabled);
}

export function getAgent(slug: string): AgentDefinition {
  const agent = listEnabledAgents().find((item) => item.slug === slug);
  if (!agent) {
    throw new Error(`Unknown or disabled agent: ${slug}`);
  }
  return agent;
}

export function assignAgents(serviceSlug: string): AgentPlan {
  const catalog = loadAgentCatalog();
  const primary = getAgent(SERVICE_AGENT_MAP[serviceSlug] ?? catalog.default_orchestrator);
  const supporting = listEnabledAgents()
    .filter((agent) => agent.slug !== primary.slug && (agent.type === 'compliance' || agent.type === 'orchestrator'))
    .slice(0, 2);

  return {
    primary: toAssignment(primary),
    supporting: supporting.map(toAssignment),
  };
}

export function resetAgentCatalogCache(): void {
  catalogCache = undefined;
}
