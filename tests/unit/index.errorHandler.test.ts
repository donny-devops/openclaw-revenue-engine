/**
 * tests/unit/index.errorHandler.test.ts
 *
 * Exercises the global error-handling middleware in src/index.ts.
 * The handler has three exit branches based on status code:
 *   - 413 → { error: 'Payload Too Large' }
 *   - other 4xx → { error: err.message || 'Bad Request' }
 *   - everything else → 500 + { error: 'Internal Server Error' }
 *
 * The 413 branch is already exercised by the performance suite's oversized
 * payload test. The 4xx and 500 branches are otherwise unreachable through
 * normal routes, so we mount a tiny throwing route on the live app to drive
 * them. This also exercises the `?? statusCode ?? 500` fallback chain and
 * the `err.message || 'Bad Request'` short-circuit.
 */

import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';

beforeAll(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_err_handler_placeholder';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_err_handler_placeholder';
  process.env.GITHUB_WEBHOOK_SECRET = 'github_err_handler_placeholder';
  process.env.LOG_LEVEL = 'silent';
});

import app from '../../src/index';

/**
 * Build a throwaway Express app whose only purpose is to forward errors into
 * the same global error-handling middleware as the production app. We extract
 * the final error-handler from `app` and remount it on a fresh app so we can
 * inject arbitrary errors without polluting the main app's route table.
 */
function makeErrorApp(err: unknown) {
  const sub = express();
  sub.get('/boom', (_req: Request, _res: Response, next: NextFunction) => {
    next(err);
  });

  // Reuse the global error handler from the real app. Express stores error
  // middleware as functions with arity 4 on `app._router.stack`.
  type Layer = { handle: (...args: unknown[]) => unknown };
  const stack = (app as unknown as { _router: { stack: Layer[] } })._router.stack;
  const errorLayer = stack.find(
    (l) => typeof l.handle === 'function' && l.handle.length === 4
  );
  if (!errorLayer) {
    throw new Error('Could not locate global error middleware on app');
  }
  sub.use(errorLayer.handle as (e: Error, r: Request, s: Response, n: NextFunction) => void);
  return sub;
}

describe('global error handler — status code branches', () => {
  it('returns 413 + Payload Too Large for errors tagged status=413', async () => {
    const err = Object.assign(new Error('request entity too large'), { status: 413 });
    const res = await request(makeErrorApp(err)).get('/boom');
    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: 'Payload Too Large' });
  });

  it('returns 413 when the error uses statusCode (not status)', async () => {
    const err = Object.assign(new Error('PayloadTooLargeError'), { statusCode: 413 });
    const res = await request(makeErrorApp(err)).get('/boom');
    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: 'Payload Too Large' });
  });

  it('returns the supplied 4xx status with err.message for client errors', async () => {
    const err = Object.assign(new Error('bad input'), { status: 422 });
    const res = await request(makeErrorApp(err)).get('/boom');
    expect(res.status).toBe(422);
    expect(res.body).toEqual({ error: 'bad input' });
  });

  it('falls back to "Bad Request" when err.message is empty on a 4xx', async () => {
    const err = Object.assign(new Error(''), { status: 400 });
    const res = await request(makeErrorApp(err)).get('/boom');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Bad Request' });
  });

  it('returns 500 + Internal Server Error for errors without a status', async () => {
    const err = new Error('unexpected blowup');
    const res = await request(makeErrorApp(err)).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal Server Error' });
  });

  it('treats explicit 5xx errors as Internal Server Error', async () => {
    const err = Object.assign(new Error('db down'), { status: 503 });
    const res = await request(makeErrorApp(err)).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal Server Error' });
  });
});
