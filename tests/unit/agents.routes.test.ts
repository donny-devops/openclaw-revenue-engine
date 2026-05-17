import request from 'supertest';

beforeAll(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_agents_routes_placeholder';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_agents_routes_placeholder';
  process.env.GITHUB_WEBHOOK_SECRET = 'github_agents_routes_placeholder';
  process.env.LOG_LEVEL = 'silent';
});

import app from '../../src/index';

describe('agent routes', () => {
  it('lists available agents with MCP plans', async () => {
    const res = await request(app).get('/agents');
    expect(res.status).toBe(200);
    expect(res.body.agents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          agent_id: 'revenue_ops_agent',
          mcp_plan: expect.any(Array),
        }),
        expect.objectContaining({
          agent_id: 'compliance_review_agent',
          mcp_plan: expect.any(Array),
        }),
      ]),
    );
  });

  it('runs an agent and returns telemetry plus MCP plan', async () => {
    const res = await request(app).post('/agents/run').send({
      request_id: 'req-http-agent-1',
      agent_id: 'revenue_ops_agent',
      objective: 'Summarize webhook event classification for recent health check',
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      request_id: 'req-http-agent-1',
      agent_id: 'revenue_ops_agent',
      risk_level: 'low',
      human_review_required: false,
    });
    expect(res.body.mcp_plan).toEqual(expect.any(Array));
    expect(res.body.telemetry.input_chars).toBeGreaterThan(0);
    expect(res.body.telemetry.mcp_plan_steps).toBe(res.body.mcp_plan.length);
  });

  it('rejects invalid agent payloads', async () => {
    const res = await request(app).post('/agents/run').send({ agent_id: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid agent run payload');
  });

  it('returns 400 for unknown agents', async () => {
    const res = await request(app).post('/agents/run').send({
      agent_id: 'does_not_exist',
      objective: 'Do something',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Unknown agent_id');
  });
});
