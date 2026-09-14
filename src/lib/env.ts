export function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return val;
}

export function optionalEnv(key: string, fallback = ''): string {
  const val = process.env[key];
  return val && val.trim().length > 0 ? val : fallback;
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function isTestEnv(): boolean {
  return process.env.NODE_ENV === 'test';
}
