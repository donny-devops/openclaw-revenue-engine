/**
 * tests/performance/load.test.ts
 *
 * Lightweight performance/load tests using Jest + Supertest.
 * For more thorough load testing in production, consider:
 *   - k6 (https://k6.io) — JS-based load testing tool
 *   - autocannon (https://github.com/mcollina/autocannon) — HTTP/1.1 benchmarking tool
 *   - Apache JMeter — full-featured load testing suite
 *
 * These smoke tests check that basic endpoints respond within acceptable
 * latency under light concurrency, and that rate limiters kick in at expected
 * thresholds without crashing the server.
 */

import request from 'supertest';

// Set env vars before importing the app
beforeAll(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_perf_placeholder';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_perf_placeholder';
  process.env.GITHUB_WEBHOOK_SECRET = 'github_perf_placeholder';
  process.env.PORT = '0';
  process.env.LOG_LEVEL = 'silent';
});

import app from '../../src/index';

// ---------------------------------------------------------------------------
// GET /health endpoint — baseline latency check
// ---------------------------------------------------------------------------

describe('Performance: GET /health', () => {
  it('responds within 100ms under no load', async () => {
    const start = Date.now();
    const res = await request(app).get('/health');
    const elapsed = Date.now() - start;

    expect(res.status).toBe(200);
    expect(elapsed).toBeLessThan(100);
  });

  it('handles 10 concurrent /health requests without errors', async () => {
    const promises = Array.from({ length: 10 }, () =>
      request(app).get('/health')
    );

    const results = await Promise.all(promises);

    results.forEach((res) => {
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
    });
  }, 5000);

  it('averages < 50ms response time over 20 requests', async () => {
    const timings: number[] = [];

    for (let i = 0; i < 20; i++) {
      const start = Date.now();
      await request(app).get('/health');
      timings.push(Date.now() - start);
    }

    const avg = timings.reduce((sum, t) => sum + t, 0) / timings.length;
    expect(avg).toBeLessThan(50);
  }, 10000);
});

// ---------------------------------------------------------------------------
// GET / endpoint — JSON serialization overhead
// ---------------------------------------------------------------------------

describe('Performance: GET /', () => {
  it('responds within 100ms', async () => {
    const start = Date.now();
    const res = await request(app).get('/');
    const elapsed = Date.now() - start;

    expect(res.status).toBe(200);
    expect(elapsed).toBeLessThan(100);
  });
});

// ---------------------------------------------------------------------------
// Rate limiter stress test (sanity check, not exhaustive)
// ---------------------------------------------------------------------------

describe('Performance: Rate limiter', () => {
  it('handles burst of 15 requests without crashing', async () => {
    const promises = Array.from({ length: 15 }, (_, i) =>
      request(app).get(`/?test=burst_${i}`)
    );

    const results = await Promise.all(promises);

    // Some may return 429 if rate limit is hit, but none should crash
    results.forEach((res) => {
      expect([200, 429]).toContain(res.status);
    });
  }, 10000);
});

// ---------------------------------------------------------------------------
// Webhook endpoint under simulated load
// ---------------------------------------------------------------------------

describe('Performance: POST /webhooks/stripe', () => {
  it('handles 5 concurrent invalid webhook calls without hanging', async () => {
    const promises = Array.from({ length: 5 }, () =>
      request(app).post('/webhooks/stripe').send('{}')
    );

    const results = await Promise.all(promises);

    // All should fail validation (400), but none should hang or 500
    results.forEach((res) => {
      expect([400, 429]).toContain(res.status);
    });
  }, 5000);
});

describe('Performance: POST /webhooks/github', () => {
  it('handles 5 concurrent invalid webhook calls without hanging', async () => {
    const promises = Array.from({ length: 5 }, () =>
      request(app).post('/webhooks/github').send('{}')
    );

    const results = await Promise.all(promises);

    // All should fail validation (400), but none should hang or 500
    results.forEach((res) => {
      expect([400, 429]).toContain(res.status);
    });
  }, 5000);
});

// ---------------------------------------------------------------------------
// Memory / resource leak checks (basic)
// ---------------------------------------------------------------------------

describe('Performance: Memory stability', () => {
  it('completes 50 sequential requests without significant memory growth', async () => {
    // Baseline: check initial memory usage
    const memBefore = process.memoryUsage().heapUsed;

    for (let i = 0; i < 50; i++) {
      await request(app).get('/health');
    }

    const memAfter = process.memoryUsage().heapUsed;
    const growth = memAfter - memBefore;

    // Allow for some growth due to caching, but not excessive leaks
    // Threshold: < 10MB growth for 50 lightweight requests
    expect(growth).toBeLessThan(10 * 1024 * 1024);
  }, 15000);
});

// ---------------------------------------------------------------------------
// Edge case: extremely large request body (should be rejected)
// ---------------------------------------------------------------------------

describe('Performance: Large payload protection', () => {
  it('rejects oversized POST body without hanging', async () => {
    const largePayload = 'x'.repeat(2 * 1024 * 1024); // 2MB string

    const res = await request(app)
      .post('/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .send(largePayload);

    // Should either be rejected by bodyParser limit (413) or fail validation (400)
    expect([400, 413, 429]).toContain(res.status);
  }, 5000);
});
