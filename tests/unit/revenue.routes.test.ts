import request from 'supertest';

beforeAll(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_revenue_routes_placeholder';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_revenue_routes_placeholder';
  process.env.GITHUB_WEBHOOK_SECRET = 'github_revenue_routes_placeholder';
  process.env.LOG_LEVEL = 'silent';
});

import app from '../../src/index';

describe('revenue routes', () => {
  it('returns revenue summary', async () => {
    const res = await request(app).get('/revenue/summary');
    expect(res.status).toBe(200);
    expect(res.body.summary).toMatchObject({
      currency: 'USD',
      enabled_lanes: 4,
      enabled_services: 5,
    });
  });

  it('lists lanes and services', async () => {
    const lanes = await request(app).get('/revenue/lanes');
    const services = await request(app).get('/revenue/services');

    expect(lanes.status).toBe(200);
    expect(services.status).toBe(200);
    expect(lanes.body.lanes).toEqual(expect.arrayContaining([expect.objectContaining({ slug: 'standard' })]));
    expect(services.body.services).toEqual(expect.arrayContaining([expect.objectContaining({ slug: 'repo-triage' })]));
  });

  it('returns OpenClaw revenue routing config', async () => {
    const res = await request(app).get('/revenue/openclaw');
    expect(res.status).toBe(200);
    expect(res.body.openclaw.engine).toMatchObject({
      name: 'openclaw-revenue-engine',
      default_lane: 'standard',
    });
  });

  it('classifies paid requests', async () => {
    const res = await request(app).post('/revenue/classify').send({
      title: 'Repo triage',
      body: 'Please review my GitHub portfolio repo and README.',
    });

    expect(res.status).toBe(200);
    expect(res.body.classification).toMatchObject({
      currency: 'USD',
      estimated_revenue: 25,
    });
    expect(res.body.classification.service.slug).toBe('repo-triage');
    expect(res.body.classification.lane.slug).toBe('standard');
  });

  it('rejects invalid classify payloads', async () => {
    const res = await request(app).post('/revenue/classify').send({ body: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid paid request payload');
  });
});
