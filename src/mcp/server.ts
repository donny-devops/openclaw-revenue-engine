import { listEnabledAgents } from '../agents/orchestrator';
import { createLaneCheckout } from '../billing/checkout';
import { getEarningsSnapshot, listPayments } from '../billing/ledger';
import { classifyPaidRequest, listRevenueLanes, listRevenueServices } from '../revenue/serviceCatalog';
import gatewayConfig from '../../config/mcp-gateway.json';

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method: string;
  params?: {
    name?: string;
    arguments?: Record<string, unknown>;
  };
}

export interface McpResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string };
}

const tools: McpTool[] = [
  {
    name: 'list_lanes',
    description: 'List enabled paid revenue lanes and prices.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_services',
    description: 'List enabled monetized services.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_agents',
    description: 'List enabled orchestrator and subagents.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'classify_paid_request',
    description: 'Classify a paid inbound request into a lane, service, and agent plan.',
    inputSchema: {
      type: 'object',
      required: ['body'],
      properties: {
        title: { type: 'string' },
        body: { type: 'string' },
        lane: { type: 'string' },
        service: { type: 'string' },
      },
    },
  },
  {
    name: 'create_checkout',
    description: 'Create a Stripe or simulated checkout session for a paid lane.',
    inputSchema: {
      type: 'object',
      required: ['body', 'customer_email'],
      properties: {
        title: { type: 'string' },
        body: { type: 'string' },
        customer_email: { type: 'string' },
        lane: { type: 'string' },
        service: { type: 'string' },
      },
    },
  },
  {
    name: 'get_earnings',
    description: 'Return collected and pending revenue from the payment ledger.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_payments',
    description: 'List payment collection records.',
    inputSchema: { type: 'object', properties: {} },
  },
];

interface GatewayServerConfig {
  slug: string;
  allowed_tools?: string[];
  human_approval_required_for?: string[];
  enabled?: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const revenueGatewayConfig = (gatewayConfig.servers as GatewayServerConfig[]).find(
  (server) => server.slug === 'revenue-engine-mcp-server',
);
const allowedTools = new Set(
  revenueGatewayConfig?.enabled === false
    ? []
    : revenueGatewayConfig?.allowed_tools ?? tools.map((tool) => tool.name),
);
const approvalRequiredTools = new Set(revenueGatewayConfig?.human_approval_required_for ?? []);

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value : undefined;

export const validateMcpRequest = (request: unknown): string | undefined => {
  if (!isRecord(request) || request.jsonrpc !== '2.0' || typeof request.method !== 'string') {
    return 'Invalid MCP JSON-RPC payload';
  }

  if (request.method === 'tools/call') {
    const params = request.params;
    if (
      !isRecord(params) ||
      typeof params.name !== 'string' ||
      ('arguments' in params && params.arguments !== undefined && !isRecord(params.arguments))
    ) {
      return 'Invalid MCP tool call payload';
    }
  }

  return undefined;
};

async function callTool(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
  switch (name) {
    case 'list_lanes':
      return { lanes: listRevenueLanes() };
    case 'list_services':
      return { services: listRevenueServices() };
    case 'list_agents':
      return { agents: listEnabledAgents() };
    case 'classify_paid_request': {
      const body = asString(args.body);
      if (!body) throw new Error('body is required');
      const classification = classifyPaidRequest({
        title: asString(args.title),
        body,
        lane: asString(args.lane),
        service: asString(args.service),
      });
      return { classification };
    }
    case 'create_checkout': {
      const body = asString(args.body);
      const customerEmail = asString(args.customer_email);
      if (!body || !customerEmail) throw new Error('body and customer_email are required');
      return createLaneCheckout({
        title: asString(args.title),
        body,
        customer_email: customerEmail,
        lane: asString(args.lane),
        service: asString(args.service),
        source: 'mcp',
      });
    }
    case 'get_earnings':
      return { earnings: getEarningsSnapshot() };
    case 'list_payments':
      return { payments: listPayments() };
    default:
      throw new Error(`Unknown MCP tool: ${name}`);
  }
}

export function listMcpTools(): McpTool[] {
  return tools;
}

export async function handleMcpRequest(request: McpRequest): Promise<McpResponse> {
  const id = request.id ?? null;
  try {
    if (request.method === 'tools/list' || request.method === 'initialize') {
      return {
        jsonrpc: '2.0',
        id,
        result: request.method === 'initialize'
          ? {
              protocolVersion: '2024-11-05',
              serverInfo: { name: 'openclaw-revenue-engine', version: '1.0.0' },
              capabilities: { tools: {} },
            }
          : { tools },
      };
    }

    if (request.method === 'tools/call') {
      const name = request.params?.name;
      if (!name) throw new Error('Tool name is required');
      if (!allowedTools.has(name)) {
        throw new Error(`Tool not allowed by MCP gateway policy: ${name}`);
      }
      if (approvalRequiredTools.has(name)) {
        throw new Error(`Tool requires human approval: ${name}`);
      }
      const args = request.params?.arguments;
      if (args !== undefined && !isRecord(args)) {
        throw new Error('Tool arguments must be an object');
      }
      const result = await callTool(name, args ?? {});
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: JSON.stringify(result) }],
          structuredContent: result,
        },
      };
    }

    throw new Error(`Unsupported MCP method: ${request.method}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown MCP error';
    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32000, message },
    };
  }
}
