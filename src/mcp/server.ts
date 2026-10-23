import { assignAgents, listEnabledAgents } from '../agents/orchestrator';
import { createLaneCheckout } from '../billing/checkout';
import { getEarningsSnapshot, listPayments } from '../billing/ledger';
import { classifyPaidRequest, listRevenueLanes, listRevenueServices } from '../revenue/serviceCatalog';
import {
  createSaraPlusOrder,
  draftHandoffMessage,
  getWorkflow,
  listOrdersNeedingFollowUp,
  listSaraPlusOrders,
  parseHandoffChannel,
  parseOrderStatus,
  parseWaitingOn,
  reviewSellerAction,
  updateSaraPlusOrder,
} from '../saraPlus';

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
  {
    name: 'sara_plus_workflow',
    description: 'Return the allowed SARA Plus seller-side touchless checklist and compliance limits.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'sara_plus_review_action',
    description: 'Classify a SARA Plus action as allowed seller-side work or a blocked customer-secure step.',
    inputSchema: {
      type: 'object',
      properties: {
        step: { type: 'string' },
        text: { type: 'string' },
      },
    },
  },
  {
    name: 'sara_plus_orders',
    description: 'Create, update, list, or remind on SARA Plus seller orders waiting on the customer.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'create', 'update', 'reminders'] },
        id: { type: 'string' },
        customer_display_name: { type: 'string' },
        order_ref: { type: 'string' },
        status: { type: 'string' },
        last_step: { type: 'string' },
        waiting_on: { type: 'string' },
        notes: { type: 'string' },
        stale_minutes: { type: 'number' },
      },
    },
  },
  {
    name: 'sara_plus_draft_handoff',
    description: 'Draft SMS/email copy that accompanies the SARA Plus secure link without collecting customer secrets.',
    inputSchema: {
      type: 'object',
      properties: {
        channel: { type: 'string' },
        customer_first_name: { type: 'string' },
        seller_name: { type: 'string' },
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
      const agentPlan = assignAgents(classification.service.slug);
      return { classification: { ...classification, assigned_agent: agentPlan.primary, agent_plan: agentPlan } };
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
    case 'sara_plus_workflow':
      return { workflow: getWorkflow() };
    case 'sara_plus_review_action': {
      if (args.step !== undefined && typeof args.step !== 'string') {
        throw new Error('step must be a string when provided');
      }
      if (args.text !== undefined && typeof args.text !== 'string') {
        throw new Error('text must be a string when provided');
      }
      return {
        verdict: reviewSellerAction({
          step: asString(args.step),
          text: asString(args.text),
        }),
      };
    }
    case 'sara_plus_orders': {
      const action = asString(args.action) ?? 'list';
      if (action === 'create') {
        return {
          order: createSaraPlusOrder({
            customer_display_name: asString(args.customer_display_name),
            order_ref: asString(args.order_ref),
            status: parseOrderStatus(asString(args.status)),
            last_step: asString(args.last_step),
            waiting_on: parseWaitingOn(asString(args.waiting_on)),
            notes: asString(args.notes),
          }),
        };
      }
      if (action === 'update') {
        const id = asString(args.id);
        if (!id) throw new Error('id is required');
        return {
          order: updateSaraPlusOrder(id, {
            customer_display_name: asString(args.customer_display_name),
            order_ref: asString(args.order_ref),
            status: parseOrderStatus(asString(args.status)),
            last_step: asString(args.last_step),
            waiting_on: parseWaitingOn(asString(args.waiting_on)),
            notes: asString(args.notes),
          }),
        };
      }
      if (action === 'reminders') {
        const staleMinutes = typeof args.stale_minutes === 'number' ? args.stale_minutes : undefined;
        return {
          orders: listOrdersNeedingFollowUp(
            Date.now(),
            staleMinutes && staleMinutes > 0 ? staleMinutes * 60 * 1000 : undefined,
          ),
        };
      }
      return { orders: listSaraPlusOrders() };
    }
    case 'sara_plus_draft_handoff':
      return {
        draft: draftHandoffMessage({
          channel: parseHandoffChannel(asString(args.channel)),
          customer_first_name: asString(args.customer_first_name),
          seller_name: asString(args.seller_name),
        }),
      };
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
