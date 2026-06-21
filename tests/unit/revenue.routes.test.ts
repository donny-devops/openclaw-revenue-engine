import request from 'supertest';

beforeAll(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_revenue_routes_placeholder';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_revenue_routes_placeholder';
  process.env.GITHUB_WEBHOOK_SECRET = 'github_revenue_routes_placeholder';
  process.env.LOG_LEVEL = 'silent';
});

import app from '../../src/index';
import * as revenueServiceCatalog from '../../src/revenue/serviceCatalog';

describe('revenue routes', () => {
  it('returns revenue summary', async () => {
    const res = await request(app).get('/revenue/summary');
    expect(res.status).toBe(200);
    expect(res.body.summary).toMatchObject({
      currency: 'USD',
      enabled_lanes: 3,
      enabled_services: 5,
      default_lane: 'detailed-request',
    });
  });

  it('lists lanes and services', async () => {
    const lanes = await request(app).get('/revenue/lanes');
    const services = await request(app).get('/revenue/services');

    expect(lanes.status).toBe(200);
    expect(services.status).toBe(200);
    expect(lanes.body.lanes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slug: 'small-request', price: 19 }),
        expect.objectContaining({ slug: 'detailed-request', price: 29 }),
        expect.objectContaining({ slug: 'real-offer', price: 49 }),
      ]),
    );
    expect(services.body.services).toEqual(expect.arrayContaining([expect.objectContaining({ slug: 'repo-triage' })]));
  });

  it('returns OpenClaw revenue routing config', async () => {
    const res = await request(app).get('/revenue/openclaw');
    expect(res.status).toBe(200);
    expect(res.body.openclaw.engine).toMatchObject({
      name: 'openclaw-revenue-engine',
      default_lane: 'detailed-request',
    });
  });

  it('classifies paid requests', async () => {
    const res = await request(app).post('/revenue/classify').send({
      title: 'Repository triage',
      body: 'Please review my GitHub portfolio repository and README.',
    });

    expect(res.status).toBe(200);
    expect(res.body.classification).toMatchObject({
      currency: 'USD',
      estimated_revenue: 29,
    });
    expect(res.body.classification.service.slug).toBe('repo-triage');
    expect(res.body.classification.lane.slug).toBe('detailed-request');
  });

  it('rejects invalid classify payloads', async () => {
    const res = await request(app).post('/revenue/classify').send({ body: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid paid request payload');
  });

  it('maps input-validation errors from classifier to 400', async () => {
    const required = await request(app).post('/revenue/classify').send({ body: '   ' });
    expect(required.status).toBe(400);
    expect(required.body.error).toBe('Paid request body is required');

    const unknown = await request(app).post('/revenue/classify').send({
      body: 'Please classify this request.',
      service: 'unknown-service',
    });
    expect(unknown.status).toBe(400);
    expect(unknown.body.error).toBe('Unknown or disabled service: unknown-service');

    const maxInput = await request(app).post('/revenue/classify').send({
      lane: 'small-request',
      body: 'x'.repeat(3200),
    });
    expect(maxInput.status).toBe(400);
    expect(maxInput.body.error).toBe('Paid request exceeds small-request lane max_input_chars limit');
  });

  it('maps non-input classifier errors to 500', async () => {
    const spy = jest.spyOn(revenueServiceCatalog, 'classifyPaidRequest')
      .mockImplementation(() => { throw new Error('unexpected failure'); });

    const res = await request(app).post('/revenue/classify').send({
      body: 'Valid payload that should parse.',
    });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Revenue configuration error');
    spy.mockRestore();
  });
});
