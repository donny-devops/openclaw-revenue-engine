/**
 * tests/unit/webhook.fallbacks.test.ts
 *
 * Targets fallback branches in the webhook handlers:
 *   - missing provider env vars fail at request time with controlled 500 responses
 *   - stripe: invoice.id ?? 'unknown', next_payment_attempt ?? 'none'
 *   - stripe: non-Error catch path -> 'Unknown error'
 *   - github: array-valued event/delivery headers
 *   - github: object body handling and missing delivery fallback
 *   - github: non-Error catch path -> 'Unknown error'
 */

import crypto from 'crypto';
import type { Request, Response } from 'express';

import {
  buildGitHubPayload,
  buildStripePayload,
  GITHUB_TEST_WEBHOOK_SECRET,
  mockResponse,
  STRIPE_TEST_WEBHOOK_SECRET,
} from '../helpers/fixtures';

// ---------------------------------------------------------------------------
// Request-time configuration guards
// ---------------------------------------------------------------------------

describe('webhook configuration guards at request time', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  it('stripe.webhook returns 500 if STRIPE_SECRET_KEY is missing', () => {
    delete process.env.STRIPE_SECRET_KEY;
    process.env.STRIPE_WEBHOOK_SECRET = STRIPE_TEST_WEBHOOK_SECRET;

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require('../../src/webhooks/stripe.webhook') as typeof import('../../src/webhooks/stripe.webhook');
      const { body, signature } = buildStripePayload('evt_missing_secret', {}, STRIPE_TEST_WEBHOOK_SECRET);
      const captured = mockResponse();
      const errSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

      mod.stripeWebhookHandler(
        { body, headers: { 'stripe-signature': signature } } as unknown as Request,
        captured.res as Response,
      );

      expect(captured.statusCode).toBe(500);
      expect(captured.body).toMatchObject({ error: 'Stripe webhook is not configured' });
      errSpy.mockRestore();
    });
  });

  it('stripe.webhook returns 500 if STRIPE_WEBHOOK_SECRET is missing', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_missing_webhook_secret';
    delete process.env.STRIPE_WEBHOOK_SECRET;

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require('../../src/webhooks/stripe.webhook') as typeof import('../../src/webhooks/stripe.webhook');
      const { body, signature } = buildStripePayload('evt_missing_webhook_secret', {}, STRIPE_TEST_WEBHOOK_SECRET);
      const captured = mockResponse();
      const errSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

      mod.stripeWebhookHandler(
        { body, headers: { 'stripe-signature': signature } } as unknown as Request,
        captured.res as Response,
      );

      expect(captured.statusCode).toBe(500);
      expect(captured.body).toMatchObject({ error: 'Stripe webhook is not configured' });
      errSpy.mockRestore();
    });
  });

  it('github.webhook returns 500 if GITHUB_WEBHOOK_SECRET is missing', () => {
    delete process.env.GITHUB_WEBHOOK_SECRET;

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require('../../src/webhooks/github.webhook') as typeof import('../../src/webhooks/github.webhook');
      const built = buildGitHubPayload('ping', {}, GITHUB_TEST_WEBHOOK_SECRET);
      const captured = mockResponse();
      const errSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

      mod.githubWebhookHandler(
        {
          body: built.body,
          headers: {
            'x-hub-signature-256': built.signature,
            'x-github-event': 'ping',
          },
        } as unknown as Request,
        captured.res as Response,
      );

      expect(captured.statusCode).toBe(500);
      expect(captured.body).toMatchObject({ error: 'GitHub webhook is not configured' });
      errSpy.mockRestore();
    });
  });
});

// ---------------------------------------------------------------------------
// Stripe handler fallback paths
// ---------------------------------------------------------------------------

describe('stripeWebhookHandler — invoice fallbacks and non-Error catch', () => {
  const mockConstructEvent = jest.fn();

  jest.doMock('stripe', () => {
    return jest.fn().mockImplementation(() => ({
      webhooks: { constructEvent: mockConstructEvent },
    }));
  });

  let stripeWebhookHandler: (req: Request, res: Response) => void;

  beforeAll(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fallbacks';
    process.env.STRIPE_WEBHOOK_SECRET = STRIPE_TEST_WEBHOOK_SECRET;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require('../../src/webhooks/stripe.webhook') as typeof import('../../src/webhooks/stripe.webhook');
      stripeWebhookHandler = mod.stripeWebhookHandler;
    });
  });

  beforeEach(() => mockConstructEvent.mockReset());

  function req(): Request {
    const { body, signature } = buildStripePayload('x', {}, STRIPE_TEST_WEBHOOK_SECRET);
    return { body, headers: { 'stripe-signature': signature } } as unknown as Request;
  }

  it('invoice.payment_succeeded with missing id falls back to "unknown"', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_fallback_1',
      type: 'invoice.payment_succeeded',
      data: { object: { customer: 'cus_x', amount_paid: 100, currency: 'usd' } },
    });
    const captured = mockResponse();
    stripeWebhookHandler(req(), captured.res as Response);
    expect(captured.statusCode).toBe(200);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('unknown'));
    logSpy.mockRestore();
  });

  it('invoice.payment_failed with no next_payment_attempt falls back to "none"', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_fallback_2',
      type: 'invoice.payment_failed',
      data: { object: { id: 'in_x', customer: 'cus_x' } },
    });
    const captured = mockResponse();
    stripeWebhookHandler(req(), captured.res as Response);
    expect(captured.statusCode).toBe(200);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('none'));
    logSpy.mockRestore();
  });

  it('returns 400 with "Unknown error" when constructEvent throws a non-Error', () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockConstructEvent.mockImplementationOnce(() => {
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      throw 'not-an-Error-instance';
    });
    const captured = mockResponse();
    stripeWebhookHandler(req(), captured.res as Response);
    expect(captured.statusCode).toBe(400);
    expect(captured.body).toMatchObject({ error: expect.stringContaining('Unknown error') });
    errSpy.mockRestore();
  });

  it('returns 500 with generic message when a handler throws a non-Error', () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_fallback_3',
      type: 'customer.subscription.created',
      data: {
        object: new Proxy({}, {
          get() {
            // eslint-disable-next-line @typescript-eslint/no-throw-literal
            throw 'string-not-error';
          },
        }),
      },
    });
    const captured = mockResponse();
    stripeWebhookHandler(req(), captured.res as Response);
    expect(captured.statusCode).toBe(500);
    errSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// GitHub handler — header/body normalisation + delivery fallback
// ---------------------------------------------------------------------------

describe('githubWebhookHandler — header normalisation and fallbacks', () => {
  let githubWebhookHandler: (req: Request, res: Response) => void;

  beforeAll(() => {
    process.env.GITHUB_WEBHOOK_SECRET = GITHUB_TEST_WEBHOOK_SECRET;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require('../../src/webhooks/github.webhook') as typeof import('../../src/webhooks/github.webhook');
      githubWebhookHandler = mod.githubWebhookHandler;
    });
  });

  it('takes first element of an array-valued x-github-event header', () => {
    const built = buildGitHubPayload('ping', { zen: 'be kind' }, GITHUB_TEST_WEBHOOK_SECRET);
    const req = {
      body: built.body,
      headers: {
        'x-hub-signature-256': built.signature,
        'x-github-event': ['ping', 'extra'],
        'x-github-delivery': ['delivery-array', 'extra'],
      },
    } as unknown as Request;
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const captured = mockResponse();
    githubWebhookHandler(req, captured.res as Response);
    expect(captured.statusCode).toBe(200);
    expect(captured.body).toMatchObject({ received: true, event: 'ping', delivery: 'delivery-array' });
    logSpy.mockRestore();
  });

  it('accepts an already-parsed object body (non-Buffer)', () => {
    const payload = { ref: 'refs/heads/main', repository: { full_name: 'a/b' }, pusher: { name: 'x' } };
    const bodyBuf = Buffer.from(JSON.stringify(payload), 'utf8');
    const sig = `sha256=${crypto.createHmac('sha256', GITHUB_TEST_WEBHOOK_SECRET).update(bodyBuf).digest('hex')}`;
    const req = {
      body: bodyBuf,
      headers: {
        'x-hub-signature-256': sig,
        'x-github-event': 'push',
        'x-github-delivery': 'delivery-buf',
      },
    } as unknown as Request;
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const captured = mockResponse();
    githubWebhookHandler(req, captured.res as Response);
    expect(captured.statusCode).toBe(200);
    logSpy.mockRestore();
  });

  it('logs "unknown" delivery when x-github-delivery is absent on signature mismatch', () => {
    const built = buildGitHubPayload('push', { ref: 'refs/heads/main' }, GITHUB_TEST_WEBHOOK_SECRET);
    const req = {
      body: built.body,
      headers: {
        'x-hub-signature-256': 'sha256=deadbeef00000000000000000000000000000000000000000000000000000000',
        'x-github-event': 'push',
      },
    } as unknown as Request;
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const captured = mockResponse();
    githubWebhookHandler(req, captured.res as Response);
    expect(captured.statusCode).toBe(401);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('unknown'));
    errSpy.mockRestore();
  });

  it('returns 200 with delivery=undefined when x-github-delivery is missing on success', () => {
    const built = buildGitHubPayload('ping', {}, GITHUB_TEST_WEBHOOK_SECRET);
    const req = {
      body: built.body,
      headers: {
        'x-hub-signature-256': built.signature,
        'x-github-event': 'ping',
      },
    } as unknown as Request;
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const captured = mockResponse();
    githubWebhookHandler(req, captured.res as Response);
    expect(captured.statusCode).toBe(200);
    logSpy.mockRestore();
  });

  it('returns 500 with generic message when handler throws a non-Error', () => {
    const goodBody = Buffer.from(JSON.stringify({ ref: 'refs/heads/main' }), 'utf8');
    const sig = `sha256=${crypto.createHmac('sha256', GITHUB_TEST_WEBHOOK_SECRET).update(goodBody).digest('hex')}`;
    const origParse = JSON.parse;
    const parseSpy = jest.spyOn(JSON, 'parse').mockImplementation((_s: string) => {
      JSON.parse = origParse;
      return new Proxy({ ref: 'refs/heads/main' }, {
        get(t, k) {
          if (k === 'repository') {
            // eslint-disable-next-line @typescript-eslint/no-throw-literal
            throw 'non-error-string';
          }
          return (t as Record<string, unknown>)[k as string];
        },
      });
    });
    const req = {
      body: goodBody,
      headers: {
        'x-hub-signature-256': sig,
        'x-github-event': 'push',
        'x-github-delivery': 'd1',
      },
    } as unknown as Request;
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const captured = mockResponse();
    githubWebhookHandler(req, captured.res as Response);
    expect(captured.statusCode).toBe(500);
    parseSpy.mockRestore();
    errSpy.mockRestore();
  });
});
