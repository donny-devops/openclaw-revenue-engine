import fs from 'fs';
import path from 'path';

import { McpInventory, McpServerConfig, McpServerView } from './types';

const repoRoot = path.resolve(__dirname, '..', '..');

function readInventory(inventoryPath = path.join(repoRoot, 'mcp', 'servers.json')): McpInventory {
  return JSON.parse(fs.readFileSync(inventoryPath, 'utf8')) as McpInventory;
}

function validateServer(server: McpServerConfig): McpServerConfig {
  if (!server.id || !server.name || !server.transport || !server.command) {
    throw new Error('Invalid MCP server config: id, name, transport, and command are required');
  }
  if (!Array.isArray(server.allowed_capabilities) || !Array.isArray(server.blocked_capabilities)) {
    throw new Error(`Invalid MCP server ${server.id}: capabilities must be arrays`);
  }
  if (!server.blocked_capabilities.includes('secret_read')) {
    throw new Error(`Invalid MCP server ${server.id}: secret_read must be blocked`);
  }
  return server;
}

export function loadMcpServers(): McpServerConfig[] {
  const inventory = readInventory();
  return inventory.servers.map(validateServer);
}

export function getMcpServer(serverId: string): McpServerConfig {
  const server = loadMcpServers().find((item) => item.id === serverId);
  if (!server) {
    throw new Error(`Unknown MCP server: ${serverId}`);
  }
  return server;
}

export function viewMcpServers(): McpServerView[] {
  return loadMcpServers().map((server) => {
    const missingEnv = server.required_env.filter((key) => !process.env[key]);
    return {
      id: server.id,
      name: server.name,
      transport: server.transport,
      allowed_capabilities: server.allowed_capabilities,
      blocked_capabilities: server.blocked_capabilities,
      purpose: server.purpose,
      configured: missingEnv.length === 0,
      missing_env: missingEnv,
    };
  });
}
