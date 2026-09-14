import request from 'supertest';

import { resetLedger } from '../../src/billing/ledger';
import { resetUsageMeter } from '../../src/billing/usageMeter';
import { operatorAuthHeaders } from '../helpers/fixtures';

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

    const earnings = await request(app).get('/revenue/earnings').set(operatorAuthHeaders());
    expect(earnings.status).toBe(200);
    expect(earnings.body.earnings.collected_cents).toBe(2900);
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
    const created = await request(app)
      .post('/usage/events')
      .set(operatorAuthHeaders())
      .send({
        tenant_id: 'tenant_demo',
        metric_type: 'agent_run',
        quantity: 2,
      });
    expect(created.status).toBe(201);

    const summary = await request(app)
      .get('/usage/summary')
      .set(operatorAuthHeaders())
      .query({ tenant_id: 'tenant_demo' });
    expect(summary.status).toBe(200);
    expect(summary.body.summary.totals_by_metric.agent_run).toBe(2);
  });

  it('handles MCP JSON-RPC classify calls', async () => {
    const res = await request(app).post('/mcp').set(operatorAuthHeaders()).send({
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
});
