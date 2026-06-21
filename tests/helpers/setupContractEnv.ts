/**
 * tests/helpers/setupContractEnv.ts
 *
 * Jest `setupFiles` entry — runs once per test file BEFORE any module under
 * test (including `src/index.ts` and the webhook modules) is imported. This
 * is the right place to seed env vars that webhook modules consume via
 * `requireEnv()` at module-load time. Using `beforeAll` from inside the test
 * file is too late: TypeScript/Jest hoists ESM-style `import` statements to
 * the top of the compiled module, so the import would run before the
 * `beforeAll` body.
 */
process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.LOG_LEVEL = 'silent';
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? 'sk_test_contract_placeholder';
process.env.STRIPE_WEBHOOK_SECRET =
  process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec_contract_placeholder';
process.env.GITHUB_WEBHOOK_SECRET =
  process.env.GITHUB_WEBHOOK_SECRET ?? 'github_contract_placeholder';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'jwt_contract_placeholder';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:3000';
