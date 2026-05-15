/**
 * tests/helpers/globalSetup.js
 *
 * Jest globalSetup — runs once before any test suite.
 * Sets the minimum environment variables required by modules that call
 * requireEnv() at module-load time (stripe.webhook.ts, github.webhook.ts).
 * Individual test files can override these values via jest.resetModules() +
 * process.env reassignment inside beforeEach / jest.isolateModules().
 */
module.exports = async function globalSetup() {
  // Stripe webhook module requires these two vars at import time.
  // Use the same fixture values exported from tests/helpers/fixtures.ts so
  // tests that assert the secret reached constructEvent see a consistent value
  // regardless of whether the module was loaded statically or via isolateModules.
  process.env.STRIPE_SECRET_KEY = 'sk_test_fixture_key_00000000000000';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_fixture_secret_00000000';

  // GitHub webhook module requires this var at import time
  process.env.GITHUB_WEBHOOK_SECRET = 'github_test_fixture_secret_00000000';

  // General app env vars
  process.env.NODE_ENV = 'test';
  process.env.PORT = '0'; // OS-assigned port — avoids EADDRINUSE in parallel suites
  process.env.LOG_LEVEL = 'silent';
  process.env.CORS_ORIGIN = 'http://localhost:3000';
};
