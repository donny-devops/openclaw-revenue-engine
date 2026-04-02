import 'dotenv/config';
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { globalRateLimiter } from './middleware/rateLimiter';

const app: Application = express();
const PORT = parseInt(process.env.PORT ?? '3000', 10);
const NODE_ENV = process.env.NODE_ENV ?? 'development';

// ─── Security Middleware ─────────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? '*',
    credentials: process.env.CORS_CREDENTIALS === 'true',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  })
);

// ─── Global Rate Limiter — mount BEFORE all routes ──────────────────────────────────
app.use(globalRateLimiter);

// ─── Body Parsing ──────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ─── Request Logging ────────────────────────────────────────────────────────────
if (NODE_ENV !== 'test') {
  app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ─── Trust Proxy (for accurate IPs behind load balancers) ───────────────────────
if (NODE_ENV === 'production') {
  app.set('trust proxy', 1);
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

// ─── 404 Handler ────────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Not Found' });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  const statusCode = (err as Error & { statusCode?: number }).statusCode ?? 500;
  const message =
    NODE_ENV === 'production' && statusCode === 500
      ? 'Internal Server Error'
      : err.message;

  if (statusCode >= 500) {
    console.error('[error]', err.stack);
  }

  res.status(statusCode).json({ success: false, error: message });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(
    `[openclaw-revenue-engine] 🚀 Listening on port ${PORT} (${NODE_ENV})`
  );
});

// ─── Graceful Shutdown ──────────────────────────────────────────────────────────
function shutdown(signal: string): void {
  console.log(`[openclaw-revenue-engine] Received ${signal}, shutting down…`);
  server.close(() => {
    console.log('[openclaw-revenue-engine] HTTP server closed.');
    process.exit(0);
  });

  // Force exit after 10s if connections don't drain
  setTimeout(() => {
    console.error('[openclaw-revenue-engine] Forcing exit after timeout.');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
