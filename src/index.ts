// ─── Bug 9 fix: load dotenv FIRST before any other imports read process.env ───
import 'dotenv/config';

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createLogger, format, transports } from 'winston';

import { stripeWebhookHandler } from './webhooks/stripe.webhook';
import { githubWebhookHandler } from './webhooks/github.webhook';

// ─── Bug 6 fix: wire up winston for structured logging ───
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
const PORT = process.env.PORT ?? 3000;

// ─── Bug 8 fix: apply rate limiting ───
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

// ─── Bug 3 + 4 fix: register webhook routes with express.raw() BEFORE global
// json() middleware. Stripe and GitHub HMAC verification requires the raw
// unparsed body Buffer. If json() runs first, req.body is a parsed object
// and signature verification always fails.
app.post(
  '/webhooks/stripe',
  webhookLimiter,
  express.raw({ type: 'application/json' }),
  stripeWebhookHandler
);

app.post(
  '/webhooks/github',
  webhookLimiter,
  express.raw({ type: 'application/json' }),
  githubWebhookHandler
);

// ─── Global Middleware (registered AFTER webhook routes) ───
app.use(globalLimiter);
app.use(helmet());

// Bug 7 fix: apply CORS_ORIGIN and CORS_CREDENTIALS from environment
app.use(cors({
  origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  credentials: process.env.CORS_CREDENTIALS === 'true',
}));

app.use(express.json());

// ─── Health Check ───
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Root ───
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'openclaw-revenue-engine',
    version: process.env.npm_package_version ?? '1.0.0',
    docs: '/health',
  });
});

// ─── 404 Handler ───
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' });
});

// ─── Bug 6 fix: global error handler uses winston with structured fields ───
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });
  res.status(500).json({ error: 'Internal Server Error' });
});

// ─── Start Server ───
app.listen(PORT, () => {
  logger.info(`[openclaw-revenue-engine] Listening on port ${PORT}`);
});

export { logger };
export default app;
