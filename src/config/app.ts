import { getOptionalEnv } from './env';

function parsePort(value: string | undefined, fallback: number): number {
  if (!value) return fallback;

  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error(`PORT must be an integer between 0 and 65535, got ${value}`);
  }

  return port;
}

function parseBoolean(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  return value.toLowerCase() === 'true';
}

function parsePositiveInteger(value: string | undefined, fallback: number, name: string): number {
  if (!value) return fallback;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer, got ${value}`);
  }

  return parsed;
}

export interface AppConfig {
  serviceName: string;
  version: string;
  nodeEnv: string;
  port: number;
  logLevel: string;
  corsOrigin: string;
  corsCredentials: boolean;
  jsonBodyLimit: string;
  globalRateLimit: {
    windowMs: number;
    max: number;
  };
  webhookRateLimit: {
    windowMs: number;
    max: number;
  };
}

export function loadAppConfig(): AppConfig {
  return {
    serviceName: getOptionalEnv('SERVICE_NAME', 'openclaw-revenue-engine') ?? 'openclaw-revenue-engine',
    version: getOptionalEnv('npm_package_version', '1.0.0') ?? '1.0.0',
    nodeEnv: getOptionalEnv('NODE_ENV', 'development') ?? 'development',
    port: parsePort(process.env.PORT, 3000),
    logLevel: getOptionalEnv('LOG_LEVEL', 'info') ?? 'info',
    corsOrigin: getOptionalEnv('CORS_ORIGIN', 'http://localhost:3000') ?? 'http://localhost:3000',
    corsCredentials: parseBoolean(process.env.CORS_CREDENTIALS),
    jsonBodyLimit: getOptionalEnv('JSON_BODY_LIMIT', '1mb') ?? '1mb',
    globalRateLimit: {
      windowMs: parsePositiveInteger(process.env.GLOBAL_RATE_LIMIT_WINDOW_MS, 60_000, 'GLOBAL_RATE_LIMIT_WINDOW_MS'),
      max: parsePositiveInteger(process.env.GLOBAL_RATE_LIMIT_MAX, 100, 'GLOBAL_RATE_LIMIT_MAX'),
    },
    webhookRateLimit: {
      windowMs: parsePositiveInteger(process.env.WEBHOOK_RATE_LIMIT_WINDOW_MS, 60_000, 'WEBHOOK_RATE_LIMIT_WINDOW_MS'),
      max: parsePositiveInteger(process.env.WEBHOOK_RATE_LIMIT_MAX, 30, 'WEBHOOK_RATE_LIMIT_MAX'),
    },
  };
}
