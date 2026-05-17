const REQUIRED_ENV_ERROR_PREFIX = 'Missing required environment variable:';

export function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${REQUIRED_ENV_ERROR_PREFIX} ${key}`);
  }
  return value;
}

export function getOptionalEnv(key: string, fallback?: string): string | undefined {
  return process.env[key] ?? fallback;
}

export function isMissingRequiredEnvError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith(REQUIRED_ENV_ERROR_PREFIX);
}

export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}
