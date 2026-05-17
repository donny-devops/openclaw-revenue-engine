export interface McpServerConfig {
  id: string;
  name: string;
  transport: 'stdio' | 'http' | 'sse';
  command: string;
  args: string[];
  required_env: string[];
  allowed_capabilities: string[];
  blocked_capabilities: string[];
  purpose: string;
}

export interface McpInventory {
  schema_version: string;
  servers: McpServerConfig[];
}

export interface McpServerView {
  id: string;
  name: string;
  transport: McpServerConfig['transport'];
  allowed_capabilities: string[];
  blocked_capabilities: string[];
  purpose: string;
  configured: boolean;
  missing_env: string[];
}

export interface McpUsagePlan {
  server_id: string;
  server_name: string;
  capability: string;
  purpose: string;
  safe_to_execute: boolean;
  blocked_reason?: string;
}
