import request from 'supertest';

import { resetLedger } from '../../src/billing/ledger';
import { resetUsageMeter } from '../../src/billing/usageMeter';

beforeAll(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_revenue_routes_placeholder';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_revenue_routes_placeholder';
  process.env.GITHUB_WEBHOOK_SECRET = 'github_revenue_routes_placeholder';
  process.env.LOG_LEVEL = 'silent';
  process.env.NODE_ENV = 'test';
});

import app from '../../src/index';

describe('money collection routes', () => {
  beforeEach(() => {
    resetLedger();
    resetUsageMeter();
    delete process.env.OPERATOR_API_KEY;
    delete process.env.JWT_SECRET;
  });

  it('creates a checkout session and collects simulated payment', async () => {
    const checkout = await request(app).post('/revenue/checkout').send({
      title: 'Repository triage',
      body: 'Please review my GitHub portfolio repository and README.',
      customer_email: 'buyer@example.com',
    });

    expect(checkout.status).toBe(201);
    expect(checkout.body.simulated).toBe(true);
    expect(checkout.body.payment.status).toBe('pending');

    const collected = await request(app)
      .post(`/revenue/payments/${checkout.body.payment.id}/collect`)
      .send();
    expect(collected.status).toBe(200);
    expect(collected.body.payment.status).toBe('paid');

    const earnings = await request(app).get('/revenue/earnings');
    expect(earnings.status).toBe(200);
    expect(earnings.body.earnings.collected_cents).toBe(2900);
  });

  it('requires operator auth for payment details and collection routes when configured', async () => {
    process.env.OPERATOR_API_KEY = 'operator-secret';

    const checkout = await request(app).post('/revenue/checkout').send({
      title: 'Repository triage',
      body: 'Please review my GitHub portfolio repository and README.',
      customer_email: 'buyer@example.com',
    });

    expect(checkout.status).toBe(201);

    const payment = await request(app).get(`/revenue/payments/${checkout.body.payment.id}`);
    expect(payment.status).toBe(401);

    const collect = await request(app).post(`/revenue/payments/${checkout.body.payment.id}/collect`).send();
    expect(collect.status).toBe(401);
  });

  it('rejects checkout without a customer email', async () => {
    const res = await request(app).post('/revenue/checkout').send({
      body: 'Please review my GitHub portfolio repository and README.',
    });
    expect(res.status).toBe(400);
  });

  it('lists agents and MCP tools', async () => {
    const agents = await request(app).get('/revenue/agents');
    const tools = await request(app).get('/mcp/tools');
    expect(agents.status).toBe(200);
    expect(tools.status).toBe(200);
    expect(agents.body.agents).toEqual(
      expect.arrayContaining([expect.objectContaining({ slug: 'revenue-intake-orchestrator' })]),
    );
  });

  it('records usage events and returns a summary', async () => {
    const created = await request(app).post('/usage/events').send({
      tenant_id: 'tenant_demo',
      metric_type: 'agent_run',
      quantity: 2,
    });
    expect(created.status).toBe(201);

    const summary = await request(app).get('/usage/summary').query({ tenant_id: 'tenant_demo' });
    expect(summary.status).toBe(200);
    expect(summary.body.summary.totals_by_metric.agent_run).toBe(2);
  });

  it('requires tenant_id for usage summaries', async () => {
    const res = await request(app).get('/usage/summary');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'tenant_id is required' });
  });

  it('handles MCP JSON-RPC classify calls', async () => {
    const res = await request(app).post('/mcp').send({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'classify_paid_request',
        arguments: { body: 'Need a DevSecOps hardening pass for scanners and dependabot.' },
      },
    });
    expect(res.status).toBe(200);
    expect(res.body.result.structuredContent.classification.service.slug).toBe('devsecops-hardening');
  });

  it('rejects MCP tool calls with non-object arguments', async () => {
    const res = await request(app).post('/mcp').send({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'classify_paid_request',
        arguments: 'invalid',
      },
    });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Invalid MCP tool call payload' });
  });

  it('rejects MCP requests without a JSON-RPC 2.0 envelope', async () => {
    const res = await request(app).post('/mcp').send({
      id: 3,
      method: 'tools/list',
    });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Invalid MCP JSON-RPC payload' });
  });

  it('supports MCP batch requests', async () => {
    const res = await request(app).post('/mcp').send([
      { jsonrpc: '2.0', id: 4, method: 'tools/list' },
      { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'list_agents' } },
    ]);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].result.tools).toEqual(expect.any(Array));
    expect(res.body[1].result.structuredContent.agents).toEqual(expect.any(Array));
  });
});
