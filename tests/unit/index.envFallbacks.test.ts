/**
 * tests/unit/index.envFallbacks.test.ts
 *
 * Exercises env-var fallback branches and app-level runtime metadata.
 */

import type { Application } from 'express';
import request from 'supertest';

describe('src/index.ts env-var fallback branches', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  function loadAppWithBareEnv(): Application {
    process.env = {
      ...originalEnv,
      STRIPE_SECRET_KEY: 'sk_test_bare_env',
      STRIPE_WEBHOOK_SECRET: 'whsec_bare_env',
      GITHUB_WEBHOOK_SECRET: 'github_bare_env',
    };
    delete process.env.LOG_LEVEL;
    delete process.env.PORT;
    delete process.env.CORS_ORIGIN;
    delete process.env.npm_package_version;

    let appInst: Application | undefined;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require('../../src/index') as { default: Application };
      appInst = mod.default;
    });

    if (!appInst) {
      throw new Error('App failed to load');
    }

    return appInst;
  }

  it('boots with default LOG_LEVEL, PORT, CORS_ORIGIN, and version when env is bare', async () => {
    const appInst = loadAppWithBareEnv();
    const res = await request(appInst).get('/');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      name: 'openclaw-revenue-engine',
      version: '1.0.0',
      readiness: '/ready',
    });
  });

  it('returns health metadata', async () => {
    const appInst = loadAppWithBareEnv();
    const res = await request(appInst).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      service: 'openclaw-revenue-engine',
      version: '1.0.0',
    });
    expect(res.body.timestamp).toEqual(expect.any(String));
  });

  it('returns readiness metadata', async () => {
    const appInst = loadAppWithBareEnv();
    const res = await request(appInst).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ready',
      service: 'openclaw-revenue-engine',
      dependencies: {
        stripeWebhook: 'lazy-configured',
        githubWebhook: 'lazy-configured',
      },
    });
  });

  it('propagates inbound x-request-id', async () => {
    const appInst = loadAppWithBareEnv();
    const res = await request(appInst).get('/health').set('x-request-id', 'req-test-123');
    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBe('req-test-123');
  });

  it('generates x-request-id when one is absent', async () => {
    const appInst = loadAppWithBareEnv();
    const res = await request(appInst).get('/health');
    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toEqual(expect.any(String));
  });
});
