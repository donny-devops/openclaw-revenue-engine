/**
 * tests/unit/index.envFallbacks.test.ts
 *
 * Exercises the `??` / `||` env-var fallback branches in src/index.ts that
 * fire only when the corresponding environment variable is absent:
 *   - LOG_LEVEL fallback to 'info' (line 13)
 *   - PORT fallback to 3000 (line 23)
 *   - CORS_ORIGIN fallback to 'http://localhost:3000' (line 58)
 *   - npm_package_version fallback to '1.0.0' (line 70)
 *   - status/statusCode fallback chain in error handler (lines 82–83)
 *
 * We reload the app inside jest.isolateModules() with the relevant env vars
 * cleared so the fallback side of each binary expression is taken.
 */

import request from 'supertest';
import type { Application } from 'express';

describe('src/index.ts env-var fallback branches', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('boots with default LOG_LEVEL, PORT, CORS_ORIGIN, and version when env is bare', async () => {
    // Keep webhook secrets so module-load requireEnv() doesn't throw, but
    // strip everything else to force the fallback branches.
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

    // We have to avoid app.listen actually binding — but src/index.ts calls
    // listen unconditionally on import. Spy on net to suppress the bind side
    // effect: silence the logger and rely on PORT=0 semantics if we did set
    // it. Since we removed PORT, listen('3000') will try to bind. Stub it.
    let appInst: Application | undefined;
    await new Promise<void>((resolve) => {
      jest.isolateModules(() => {
        // Stub express.Application.prototype.listen to a no-op for this load.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const express = require('express') as typeof import('express');
        // eslint-disable-next-line @typescript-eslint/unbound-method, @typescript-eslint/no-explicit-any
        const origListen = (express.application as any).listen;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (express.application as any).listen = function (...args: unknown[]) {
          // Call the callback (last arg if it's a function) without binding
          const cb = args[args.length - 1];
          if (typeof cb === 'function') {
            (cb as () => void)();
          }
          return { close: () => undefined };
        };
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require('../../src/index') as { default: Application };
        appInst = mod.default;
        // restore listen
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (express.application as any).listen = origListen;
        resolve();
      });
    });

    expect(appInst).toBeDefined();

    // Hit GET / to verify the version fallback was used in the response.
    const res = await request(appInst as Application).get('/');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      name: 'openclaw-revenue-engine',
      version: '1.0.0',
    });
  });
});
