import { listEnabledAgents } from '../agents/orchestrator';
import { createLaneCheckout } from '../billing/checkout';
import { classifyPaidRequest, listRevenueLanes, listRevenueServices } from '../revenue/serviceCatalog';

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
];

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value : undefined;

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
      const result = await callTool(name, request.params?.arguments ?? {});
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
