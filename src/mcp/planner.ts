import { AgentManifest } from '../agents/types';
import { loadMcpServers } from './registry';
import { McpUsagePlan } from './types';

function inferCapability(tool: string): string {
  if (tool.includes('github') || tool.includes('repo') || tool.includes('pull_request')) return 'repo_read';
  if (tool.includes('runbook') || tool.includes('policy') || tool.includes('docs')) return 'file_read';
  if (tool.includes('secret')) return 'secret_read';
  return 'file_read';
}

export function planMcpUsage(agent: AgentManifest): McpUsagePlan[] {
  const servers = loadMcpServers();
  return agent.allowed_tools.map((tool) => {
    const capability = inferCapability(tool);
    const server = servers.find((candidate) => candidate.allowed_capabilities.includes(capability));

    if (!server) {
      return {
        server_id: 'none',
        server_name: 'No compatible MCP server',
        capability,
        purpose: `No configured MCP server can satisfy tool ${tool}.`,
        safe_to_execute: false,
        blocked_reason: 'missing_capability',
      };
    }

    if (server.blocked_capabilities.includes(capability)) {
      return {
        server_id: server.id,
        server_name: server.name,
        capability,
        purpose: `Tool ${tool} maps to blocked capability ${capability}.`,
        safe_to_execute: false,
        blocked_reason: 'capability_blocked',
      };
    }

    return {
      server_id: server.id,
      server_name: server.name,
      capability,
      purpose: `Use ${server.name} for ${tool} via ${capability}.`,
      safe_to_execute: true,
    };
  });
}
