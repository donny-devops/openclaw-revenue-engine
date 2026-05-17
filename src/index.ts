import 'dotenv/config';

import crypto from 'crypto';
import cors from 'cors';
import express, { Application, NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { createLogger, format, transports } from 'winston';

import { loadAppConfig } from './config/app';
import { githubWebhookHandler } from './webhooks/github.webhook';
import { stripeWebhookHandler } from './webhooks/stripe.webhook';

const appConfig = loadAppConfig();

const logger = createLogger({
  level: appConfig.logLevel,
  format: format.combine(format.timestamp(), format.errors({ stack: true }), format.json()),
  transports: [new transports.Console()],
});

function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const inboundRequestId = req.header('x-request-id');
  const requestId = inboundRequestId && inboundRequestId.trim() ? inboundRequestId : crypto.randomUUID();

  res.setHeader('x-request-id', requestId);
  res.locals.requestId = requestId;
  next();
}

function createApp(config = appConfig): Application {
  const app: Application = express();

  const globalLimiter = rateLimit({
    windowMs: config.globalRateLimit.windowMs,
    max: config.globalRateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  });

  const webhookLimiter = rateLimit({
    windowMs: config.webhookRateLimit.windowMs,
    max: config.webhookRateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many webhook requests.' },
  });

  app.disable('x-powered-by');
  app.use(requestIdMiddleware);

  app.post(
    '/webhooks/stripe',
    webhookLimiter,
    express.raw({ type: 'application/json', limit: config.jsonBodyLimit }),
    stripeWebhookHandler
  );

  app.post(
    '/webhooks/github',
    webhookLimiter,
    express.raw({ type: 'application/json', limit: config.jsonBodyLimit }),
    githubWebhookHandler
  );

  app.use(globalLimiter);
  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigin,
      credentials: config.corsCredentials,
    })
  );
  app.use(express.json({ limit: config.jsonBodyLimit }));

  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: config.serviceName,
      version: config.version,
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/ready', (_req: Request, res: Response) => {
    res.json({
      status: 'ready',
      service: config.serviceName,
      dependencies: {
        stripeWebhook: 'lazy-configured',
        githubWebhook: 'lazy-configured',
      },
    });
  });

  app.get('/', (_req: Request, res: Response) => {
    res.json({
      name: config.serviceName,
      version: config.version,
      docs: '/health',
      readiness: '/ready',
    });
  });

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not Found', requestId: res.locals.requestId });
  });

  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    const status =
      (err as { status?: number; statusCode?: number }).status ??
      (err as { status?: number; statusCode?: number }).statusCode ??
      500;

    logger.error('Unhandled error', {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      status,
      requestId: res.locals.requestId,
    });

    if (status === 413) {
      res.status(413).json({ error: 'Payload Too Large', requestId: res.locals.requestId });
      return;
    }
    if (status >= 400 && status < 500) {
      res.status(status).json({ error: err.message || 'Bad Request', requestId: res.locals.requestId });
      return;
    }
    res.status(500).json({ error: 'Internal Server Error', requestId: res.locals.requestId });
  });

  return app;
}

const app = createApp();

export { appConfig, createApp, logger };
export default app;
