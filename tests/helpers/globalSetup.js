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
  // Stripe webhook module requires these two vars at import time
  process.env.STRIPE_SECRET_KEY = 'sk_test_globalsetup_placeholder';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_globalsetup_placeholder';

  // GitHub webhook module requires this var at import time
  process.env.GITHUB_WEBHOOK_SECRET = 'github_globalsetup_placeholder';

  // General app env vars
  process.env.NODE_ENV = 'test';
  process.env.PORT = '0'; // OS-assigned port — avoids EADDRINUSE in parallel suites
  process.env.LOG_LEVEL = 'silent';
  process.env.CORS_ORIGIN = 'http://localhost:3000';
};
