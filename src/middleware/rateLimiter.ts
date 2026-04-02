/**
 * src/middleware/rateLimiter.ts
 *
 * Global rate limiter for the OpenClaw Revenue Engine.
 *
 * Strategy:
 *   - Primary:  Redis sliding-window via `rate-limiter-flexible`
 *   - Fallback: In-memory limiter (same interface) when Redis is unavailable
 *
 * Environment variables:
 *   RATE_LIMIT_WINDOW_MS   Window size in milliseconds  (default: 60000 = 1 min)
 *   RATE_LIMIT_MAX         Max requests per window      (default: 100)
 *   RATE_LIMIT_SKIP_IPS    Comma-separated IPs to skip  (default: '')
 *   REDIS_URL              Redis connection string       (optional)
 */

import type { Request, Response, NextFunction } from 'express';
import {
  RateLimiterRedis,
  RateLimiterMemory,
  RateLimiterAbstract,
  RateLimiterRes,
} from 'rate-limiter-flexible';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10);
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX ?? '100', 10);
const SKIP_IPS = new Set(
  (process.env.RATE_LIMIT_SKIP_IPS ?? '')
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean)
);

// ---------------------------------------------------------------------------
// Limiter factory
// ---------------------------------------------------------------------------

function buildLimiter(): RateLimiterAbstract {
  const opts = {
    points: MAX_REQUESTS,
    duration: Math.ceil(WINDOW_MS / 1000), // rate-limiter-flexible uses seconds
    keyPrefix: 'rl:global',
  };

  if (process.env.REDIS_URL) {
    try {
      // Lazy-require so the app starts even if `ioredis` is not installed.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Redis = require('ioredis') as typeof import('ioredis').default;
      const client = new Redis(process.env.REDIS_URL, {
        enableOfflineQueue: false,
        lazyConnect: true,
      });

      client.on('error', (err: Error) => {
        console.warn('[rateLimiter] Redis error — falling back to memory:', err.message);
      });

      console.info('[rateLimiter] Using Redis sliding-window limiter');
      return new RateLimiterRedis({ ...opts, storeClient: client });
    } catch (err) {
      console.warn('[rateLimiter] Could not initialise Redis limiter, using memory:', err);
    }
  }

  console.info('[rateLimiter] Using in-memory limiter (no REDIS_URL set)');
  return new RateLimiterMemory(opts);
}

const limiter: RateLimiterAbstract = buildLimiter();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the real client IP, honouring common proxy headers. */
function resolveIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return first.trim();
  }
  return req.socket.remoteAddress ?? 'unknown';
}

/** Set standard rate-limit response headers. */
function setHeaders(res: Response, result: RateLimiterRes): void {
  res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, result.remainingPoints ?? 0));
  res.setHeader(
    'X-RateLimit-Reset',
    Math.ceil(Date.now() / 1000 + (result.msBeforeNext ?? 0) / 1000)
  );
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/**
 * globalRateLimiter
 *
 * Drop-in Express middleware. Mount it BEFORE all routes:
 *
 *   import { globalRateLimiter } from './middleware/rateLimiter';
 *   app.use(globalRateLimiter);
 */
export async function globalRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const ip = resolveIp(req);

  // Allow-listed IPs bypass the limiter entirely.
  if (SKIP_IPS.has(ip)) {
    next();
    return;
  }

  try {
    const result = await limiter.consume(ip);
    setHeaders(res, result);
    next();
  } catch (err) {
    if (err instanceof RateLimiterRes) {
      setHeaders(res, err);
      res.setHeader('Retry-After', Math.ceil((err.msBeforeNext ?? 0) / 1000));
      res.status(429).json({
        success: false,
        error: 'Too Many Requests',
        retryAfterSeconds: Math.ceil((err.msBeforeNext ?? 0) / 1000),
      });
      return;
    }

    // Unexpected error — fail open so a Redis blip doesn't take down the API.
    console.error('[rateLimiter] Unexpected error, failing open:', err);
    next();
  }
}

// ---------------------------------------------------------------------------
// Named export of config (useful for tests)
// ---------------------------------------------------------------------------

export const rateLimiterConfig = {
  windowMs: WINDOW_MS,
  maxRequests: MAX_REQUESTS,
  skipIps: SKIP_IPS,
} as const;
