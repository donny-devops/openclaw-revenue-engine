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

  it('rejects classify payloads whose body is whitespace-only', async () => {
    const res = await request(app).post('/revenue/classify').send({ body: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Paid request body is required');
  });

  it('returns input errors from classifier when lane is unknown', async () => {
    const res = await request(app).post('/revenue/classify').send({
      body: 'Please process this request.',
      lane: 'unknown-lane',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Unknown or disabled lane: unknown-lane');
  });
});

describe('revenue routes classify unexpected errors', () => {
  const buildAppWithClassifierError = (thrown: unknown) => {
    jest.resetModules();

    jest.doMock('../../src/revenue/serviceCatalog', () => ({
      classifyPaidRequest: jest.fn(() => { throw thrown; }),
      getRevenueSummary: jest.fn(() => ({})),
      listRevenueLanes: jest.fn(() => []),
      listRevenueServices: jest.fn(() => []),
    }));

    jest.doMock('../../src/revenue/config', () => ({
      loadOpenClawConfig: jest.fn(() => ({ engine: { name: 'openclaw-revenue-engine' } })),
    }));

    process.env.STRIPE_SECRET_KEY = 'sk_test_revenue_routes_placeholder';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_revenue_routes_placeholder';
    process.env.GITHUB_WEBHOOK_SECRET = 'github_revenue_routes_placeholder';
    process.env.LOG_LEVEL = 'silent';

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('../../src/index').default;
  };

  afterEach(() => {
    jest.dontMock('../../src/revenue/serviceCatalog');
    jest.dontMock('../../src/revenue/config');
    jest.resetModules();
  });

  it('returns 500 with generic message when classifier throws a config/runtime Error', async () => {
    const mockedApp = buildAppWithClassifierError(new Error('database unavailable'));
    const res = await request(mockedApp).post('/revenue/classify').send({ body: 'Valid body' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Revenue configuration error');
  });

  it('returns 500 unknown classification message when classifier throws non-Error values', async () => {
    const mockedApp = buildAppWithClassifierError({ boom: true });
    const res = await request(mockedApp).post('/revenue/classify').send({ body: 'Valid body' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Revenue configuration error');
  });
});
