/**
 * tests/unit/index.errorHandler.test.ts
 *
 * Exercises the global error-handling middleware in src/index.ts.
 */

import express, { NextFunction, Request, Response } from 'express';
import request from 'supertest';

beforeAll(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_err_handler_placeholder';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_err_handler_placeholder';
  process.env.GITHUB_WEBHOOK_SECRET = 'github_err_handler_placeholder';
  process.env.LOG_LEVEL = 'silent';
});

import app from '../../src/index';

function makeErrorApp(err: unknown) {
  const sub = express();
  sub.use((_req: Request, res: Response, next: NextFunction) => {
    res.locals.requestId = 'test-request-id';
    next();
  });
  sub.get('/boom', (_req: Request, _res: Response, next: NextFunction) => {
    next(err);
  });

  type Layer = { handle: (...args: unknown[]) => unknown };
  const stack = (app as unknown as { _router: { stack: Layer[] } })._router.stack;
  const errorLayer = stack.find((layer) => typeof layer.handle === 'function' && layer.handle.length === 4);
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
    expect(res.body).toEqual({ error: 'Payload Too Large', requestId: 'test-request-id' });
  });

  it('returns 413 when the error uses statusCode instead of status', async () => {
    const err = Object.assign(new Error('PayloadTooLargeError'), { statusCode: 413 });
    const res = await request(makeErrorApp(err)).get('/boom');
    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: 'Payload Too Large', requestId: 'test-request-id' });
  });

  it('returns the supplied 4xx status with err.message for client errors', async () => {
    const err = Object.assign(new Error('bad input'), { status: 422 });
    const res = await request(makeErrorApp(err)).get('/boom');
    expect(res.status).toBe(422);
    expect(res.body).toEqual({ error: 'bad input', requestId: 'test-request-id' });
  });

  it('falls back to Bad Request when err.message is empty on a 4xx', async () => {
    const err = Object.assign(new Error(''), { status: 400 });
    const res = await request(makeErrorApp(err)).get('/boom');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Bad Request', requestId: 'test-request-id' });
  });

  it('returns 500 + Internal Server Error for errors without a status', async () => {
    const err = new Error('unexpected blowup');
    const res = await request(makeErrorApp(err)).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal Server Error', requestId: 'test-request-id' });
  });

  it('treats explicit 5xx errors as Internal Server Error', async () => {
    const err = Object.assign(new Error('db down'), { status: 503 });
    const res = await request(makeErrorApp(err)).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal Server Error', requestId: 'test-request-id' });
  });
});
