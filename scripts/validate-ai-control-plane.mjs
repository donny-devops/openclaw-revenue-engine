import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

function readJson(relativePath) {
  const fullPath = path.join(repoRoot, relativePath);
  try {
    return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  } catch (error) {
    throw new Error(`Failed to read valid JSON from ${relativePath}: ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function validateAgent(relativePath) {
  const agent = readJson(relativePath);
  assert(agent.schema_version, `${relativePath}: schema_version is required`);
  assert(agent.agent_id, `${relativePath}: agent_id is required`);
  assert(agent.name, `${relativePath}: name is required`);
  assert(agent.model_profile, `${relativePath}: model_profile is required`);
  assert(Array.isArray(agent.allowed_tools), `${relativePath}: allowed_tools must be an array`);
  assert(Array.isArray(agent.inputs), `${relativePath}: inputs must be an array`);
  assert(Array.isArray(agent.outputs), `${relativePath}: outputs must be an array`);
  assert(agent.guardrails && typeof agent.guardrails === 'object', `${relativePath}: guardrails object is required`);
  return agent;
}

function validateModelRouting(agents) {
  const routing = readJson('config/model-routing.json');
  assert(routing.default_profile, 'config/model-routing.json: default_profile is required');
  assert(routing.profiles && typeof routing.profiles === 'object', 'config/model-routing.json: profiles object is required');
  assert(routing.profiles[routing.default_profile], 'config/model-routing.json: default_profile must exist in profiles');

  for (const agent of agents) {
    assert(
      routing.profiles[agent.model_profile],
      `Agent ${agent.agent_id} references missing model profile ${agent.model_profile}`,
    );
  }
}

function validateMcpServers() {
  const inventory = readJson('mcp/servers.json');
  assert(Array.isArray(inventory.servers), 'mcp/servers.json: servers must be an array');

  const ids = new Set();
  for (const server of inventory.servers) {
    assert(server.id, 'mcp/servers.json: server.id is required');
    assert(!ids.has(server.id), `mcp/servers.json: duplicate server id ${server.id}`);
    ids.add(server.id);
    assert(server.transport, `${server.id}: transport is required`);
    assert(server.command, `${server.id}: command is required`);
    assert(Array.isArray(server.allowed_capabilities), `${server.id}: allowed_capabilities must be an array`);
    assert(Array.isArray(server.blocked_capabilities), `${server.id}: blocked_capabilities must be an array`);
    assert(
      server.blocked_capabilities.includes('secret_read'),
      `${server.id}: blocked_capabilities must include secret_read`,
    );
  }
}

function main() {
  const agentFiles = fs
    .readdirSync(path.join(repoRoot, 'agents'))
    .filter((file) => file.endsWith('.json'))
    .map((file) => `agents/${file}`)
    .sort();

  assert(agentFiles.length > 0, 'At least one agent manifest is required');

  const agents = agentFiles.map(validateAgent);
  validateModelRouting(agents);
  validateMcpServers();

  console.log(`Validated ${agents.length} agent manifest(s), model routing, and MCP inventory.`);
}

main();
