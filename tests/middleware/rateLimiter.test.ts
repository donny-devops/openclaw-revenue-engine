/**
 * tests/middleware/rateLimiter.test.ts
 *
 * Unit + integration tests for the global rate limiter middleware.
 * Runs fully in-memory — no Redis required.
 */

import type { Request, Response, NextFunction } from 'express';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides,
  } as unknown as Request;
}

function makeRes(): Response & {
  _headers: Record<string, string | number>;
  _status: number;
  _body: unknown;
} {
  const headers: Record<string, string | number> = {};
  const res = {
    _headers: headers,
    _status: 200,
    _body: null,
    setHeader(k: string, v: string | number) {
      headers[k] = v;
      return this;
    },
    status(code: number) {
      this._status = code;
      return this;
    },
    json(body: unknown) {
      this._body = body;
      return this;
    },
  };
  return res as unknown as ReturnType<typeof makeRes>;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('rateLimiter middleware', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...OLD_ENV,
      RATE_LIMIT_WINDOW_MS: '1000',
      RATE_LIMIT_MAX: '3',
      RATE_LIMIT_SKIP_IPS: '',
      REDIS_URL: '', // force in-memory
    };
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('calls next() and sets X-RateLimit headers on allowed requests', async () => {
    const { globalRateLimiter } = await import(
      '../../src/middleware/rateLimiter'
    );
    const req = makeReq();
    const res = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    await globalRateLimiter(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res._headers['X-RateLimit-Limit']).toBe(3);
    expect(typeof res._headers['X-RateLimit-Remaining']).toBe('number');
    expect(typeof res._headers['X-RateLimit-Reset']).toBe('number');
  });

  it('returns 429 and sets Retry-After after limit is exceeded', async () => {
    const { globalRateLimiter } = await import(
      '../../src/middleware/rateLimiter'
    );
    const req = makeReq({ socket: { remoteAddress: '10.0.0.1' } } as Partial<Request>);
    const res = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    // Exhaust the 3-request limit
    for (let i = 0; i < 3; i++) {
      await globalRateLimiter(req, res, next);
    }
    // 4th request should be blocked
    await globalRateLimiter(req, res, next);

    expect(res._status).toBe(429);
    expect((res._body as { error: string }).error).toBe('Too Many Requests');
    expect(res._headers['Retry-After']).toBeGreaterThanOrEqual(0);
  });

  it('bypasses rate limit for allow-listed IPs', async () => {
    process.env.RATE_LIMIT_SKIP_IPS = '192.168.1.100';
    process.env.RATE_LIMIT_MAX = '1';

    const { globalRateLimiter } = await import(
      '../../src/middleware/rateLimiter'
    );
    const req = makeReq({ socket: { remoteAddress: '192.168.1.100' } } as Partial<Request>);
    const res = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    // Should pass even after many requests
    for (let i = 0; i < 10; i++) {
      await globalRateLimiter(req, res, next);
    }

    expect(next).toHaveBeenCalledTimes(10);
    expect(res._status).toBe(200); // never set to 429
  });

  it('resolves IP from X-Forwarded-For header', async () => {
    const { globalRateLimiter } = await import(
      '../../src/middleware/rateLimiter'
    );
    const req = makeReq({
      headers: { 'x-forwarded-for': '203.0.113.42, 10.0.0.1' },
      socket: { remoteAddress: '10.0.0.1' },
    } as Partial<Request>);
    const res = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    // Should not throw and should call next
    await globalRateLimiter(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('rateLimiterConfig exports', () => {
  it('exports correct config values', async () => {
    process.env.RATE_LIMIT_WINDOW_MS = '30000';
    process.env.RATE_LIMIT_MAX = '50';
    process.env.RATE_LIMIT_SKIP_IPS = '127.0.0.1,::1';

    const { rateLimiterConfig } = await import(
      '../../src/middleware/rateLimiter'
    );

    expect(rateLimiterConfig.windowMs).toBe(30000);
    expect(rateLimiterConfig.maxRequests).toBe(50);
    expect(rateLimiterConfig.skipIps.has('127.0.0.1')).toBe(true);
    expect(rateLimiterConfig.skipIps.has('::1')).toBe(true);
  });
});
