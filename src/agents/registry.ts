import fs from 'fs';
import path from 'path';

import { AgentManifest, ModelRoutingPolicy } from './types';

const repoRoot = path.resolve(__dirname, '..', '..');

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function assertManifest(value: AgentManifest): AgentManifest {
  if (!value.agent_id || !value.name || !value.model_profile) {
    throw new Error('Invalid agent manifest: agent_id, name, and model_profile are required');
  }
  if (!Array.isArray(value.allowed_tools) || !Array.isArray(value.inputs) || !Array.isArray(value.outputs)) {
    throw new Error(`Invalid agent manifest ${value.agent_id}: allowed_tools, inputs, and outputs must be arrays`);
  }
  return value;
}

export function loadAgentManifests(agentDir = path.join(repoRoot, 'agents')): AgentManifest[] {
  if (!fs.existsSync(agentDir)) return [];

  return fs
    .readdirSync(agentDir)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => assertManifest(readJson<AgentManifest>(path.join(agentDir, file))));
}

export function loadAgentManifest(agentId: string): AgentManifest {
  const manifest = loadAgentManifests().find((agent) => agent.agent_id === agentId);
  if (!manifest) {
    throw new Error(`Unknown agent_id: ${agentId}`);
  }
  return manifest;
}

export function loadModelRoutingPolicy(
  policyPath = path.join(repoRoot, 'config', 'model-routing.json'),
): ModelRoutingPolicy {
  const policy = readJson<ModelRoutingPolicy>(policyPath);
  if (!policy.default_profile || !policy.profiles?.[policy.default_profile]) {
    throw new Error('Invalid model routing policy: default_profile must exist in profiles');
  }
  return policy;
}
