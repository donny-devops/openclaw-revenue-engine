// ─── Bug 9 fix: load dotenv FIRST before any other imports read process.env ───
import 'dotenv/config';

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createLogger, format, transports } from 'winston';

import { stripeWebhookHandler } from './webhooks/stripe.webhook';
import { githubWebhookHandler } from './webhooks/github.webhook';

// ─── Bug 6 fix: wire up winston for structured logging ────────────────────────
const logger = createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [new transports.Console()],
});

const app: Application = express();
const PORT = parseInt(process.env.PORT ?? '3000', 10);
const NODE_ENV = process.env.NODE_ENV ?? 'development';

// ─── Bug 8 fix: apply rate limiting ──────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const webhookLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many webhook requests.' },
});

// ─── Trust Proxy (for accurate IPs behind load balancers) ────────────────────
if (NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// ─── Bug 3 + 4 fix: webhook routes with raw body BEFORE json() ───────────────
function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

app.post(
  '/webhooks/stripe',
  webhookLimiter,
  express.raw({ type: 'application/json' }),
  asyncHandler(stripeWebhookHandler)
);

app.post(
  '/webhooks/github',
  webhookLimiter,
  express.raw({ type: 'application/json' }),
  asyncHandler(githubWebhookHandler)
);

// ─── Global Middleware (registered AFTER webhook routes) ─────────────────────
app.use(globalLimiter);
app.use(helmet());

// Bug 7 fix: apply CORS_ORIGIN and CORS_CREDENTIALS from environment
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? '*',
    credentials: process.env.CORS_CREDENTIALS === 'true',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  })
);

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ─── Request Logging ──────────────────────────────────────────────────────────
if (NODE_ENV !== 'test') {
  app.use((req, _res, next) => {
    logger.http(`${req.method} ${req.path}`);
    next();
  });
}

// ─── Health & Root Routes ─────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'openclaw-revenue-engine',
    version: process.env.npm_package_version ?? '1.0.0',
    environment: NODE_ENV,
    docs: '/health',
  });
});

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Not Found' });
});

// ─── Bug 6 fix: global error handler with winston + statusCode passthrough ───
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  const statusCode = (err as Error & { statusCode?: number }).statusCode ?? 500;
  const message =
    NODE_ENV === 'production' && statusCode === 500
      ? 'Internal Server Error'
      : err.message;

  if (statusCode >= 500) {
    logger.error('Unhandled error', {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
  }

  res.status(statusCode).json({ success: false, error: message });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  logger.info(`[openclaw-revenue-engine] 🚀 Listening on port ${PORT} (${NODE_ENV})`);
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
function shutdown(signal: string): void {
  logger.info(`[openclaw-revenue-engine] Received ${signal}, shutting down…`);
  server.close(() => {
    logger.info('[openclaw-revenue-engine] HTTP server closed.');
    process.exit(0);
  });
  setTimeout(() => {
    logger.error('[openclaw-revenue-engine] Forcing exit after timeout.');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export { logger };
export default app;