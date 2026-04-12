import 'dotenv/config';

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createLogger, format, transports } from 'winston';

import { stripeWebhookHandler } from './webhooks/stripe.webhook';
import { githubWebhookHandler } from './webhooks/github.webhook';

/**
 * Wrap a synchronous (req, res) handler as Express middleware.
 * Unlike a bare `as RequestHandler` cast this will surface a type error
 * if the handler signature ever changes (e.g. becomes async).
 */
function syncHandler(fn: (req: express.Request, res: express.Response) => void): express.RequestHandler {
  return (req, res, _next) => fn(req, res);
}

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

app.post(
  '/webhooks/stripe',
  webhookLimiter,
  express.raw({ type: 'application/json' }),
  syncHandler(stripeWebhookHandler)
);

app.post(
  '/webhooks/github',
  webhookLimiter,
  express.raw({ type: 'application/json' }),
  syncHandler(githubWebhookHandler)
);

app.use(globalLimiter);
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  credentials: process.env.CORS_CREDENTIALS === 'true',
}));
app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'openclaw-revenue-engine',
    version: process.env.npm_package_version ?? '1.0.0',
    docs: '/health',
  });
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' });
});

app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
  logger.info(`[openclaw-revenue-engine] Listening on port ${PORT}`);
});

export { logger };
export default app;
