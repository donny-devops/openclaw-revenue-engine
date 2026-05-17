import request from 'supertest';

import { loadAgentManifest } from '../../src/agents/registry';
import { planMcpUsage } from '../../src/mcp/planner';
import { getMcpServer, viewMcpServers } from '../../src/mcp/registry';

beforeAll(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_mcp_routes_placeholder';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_mcp_routes_placeholder';
  process.env.GITHUB_WEBHOOK_SECRET = 'github_mcp_routes_placeholder';
  process.env.LOG_LEVEL = 'silent';
});

import app from '../../src/index';

describe('MCP runtime', () => {
  it('loads MCP inventory and redacts command execution details from views', () => {
    const servers = viewMcpServers();
    expect(servers.length).toBeGreaterThanOrEqual(2);
    expect(servers[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        configured: expect.any(Boolean),
        missing_env: expect.any(Array),
      }),
    );
    expect(servers[0]).not.toHaveProperty('command');
  });

  it('throws for unknown MCP servers', () => {
    expect(() => getMcpServer('missing')).toThrow('Unknown MCP server');
  });

  it('plans MCP usage for revenue ops agent without enabling secret reads', () => {
    const agent = loadAgentManifest('revenue_ops_agent');
    const plan = planMcpUsage(agent);
    expect(plan.length).toBe(agent.allowed_tools.length);
    expect(plan.every((step) => step.capability !== 'secret_read')).toBe(true);
  });

  it('lists MCP servers over HTTP', async () => {
    const res = await request(app).get('/mcp/servers');
    expect(res.status).toBe(200);
    expect(res.body.servers).toEqual(expect.any(Array));
    expect(res.body.servers[0]).not.toHaveProperty('command');
  });

  it('returns one MCP server by id over HTTP', async () => {
    const res = await request(app).get('/mcp/servers/filesystem_docs');
    expect(res.status).toBe(200);
    expect(res.body.server).toMatchObject({
      id: 'filesystem_docs',
      blocked_capabilities: expect.arrayContaining(['secret_read']),
    });
  });

  it('returns 404 for unknown MCP server over HTTP', async () => {
    const res = await request(app).get('/mcp/servers/missing');
    expect(res.status).toBe(404);
    expect(res.body.error).toContain('Unknown MCP server');
  });
});
