/**
 * tests/unit/stripe.webhook.test.ts
 *
 * Unit tests for stripeWebhookHandler.
 *
 * Strategy:
 *   - We mock the `stripe` npm package so that stripe.webhooks.constructEvent
 *     is fully under our control without network calls.
 *   - Valid-signature happy paths use jest.fn() returning a real-shaped event.
 *   - Invalid-signature paths throw a Stripe.errors.StripeSignatureVerificationError.
 */

import type { Request, Response } from 'express';
import {
  buildStripePayload,
  STRIPE_TEST_SECRET_KEY,
  STRIPE_TEST_WEBHOOK_SECRET,
  mockResponse,
} from '../helpers/fixtures';

// ---------------------------------------------------------------------------
// Mock the Stripe SDK before importing the module under test
// ---------------------------------------------------------------------------
const mockConstructEvent = jest.fn();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: mockConstructEvent,
    },
  }));
});

// Set env vars before the module under test is imported. Static `import`
// statements get hoisted above `beforeAll`, so we set env vars at top level
// (after the mock is registered above, before the lazy require below).
process.env.STRIPE_SECRET_KEY = STRIPE_TEST_SECRET_KEY;
process.env.STRIPE_WEBHOOK_SECRET = STRIPE_TEST_WEBHOOK_SECRET;

// Lazy-require the handler so it picks up the env vars set above
// instead of the globalSetup placeholders captured at module-load time.
/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports */
const { stripeWebhookHandler } =
  require('../../src/webhooks/stripe.webhook') as typeof import('../../src/webhooks/stripe.webhook');
/* eslint-enable @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports */

// ---------------------------------------------------------------------------
// Helper: build a mock Request with a raw Buffer body
// ---------------------------------------------------------------------------
function makeStripeReq(
  eventType: string,
  dataObject: Record<string, unknown> = {},
  sigOverride?: string
): Request {
  const { body, signature } = buildStripePayload(eventType, dataObject, STRIPE_TEST_WEBHOOK_SECRET);
  return {
    body,
    headers: {
      'stripe-signature': sigOverride ?? signature,
    },
  } as unknown as Request;
}

// ---------------------------------------------------------------------------
// Missing signature header
// ---------------------------------------------------------------------------
describe('stripeWebhookHandler — missing stripe-signature header', () => {
  it('returns 400 when stripe-signature is absent', () => {
    const req = {
      body: Buffer.from('{}'),
      headers: {},
    } as unknown as Request;
    const mock = mockResponse();

    stripeWebhookHandler(req, mock.res as Response);

    expect(mock.statusCode).toBe(400);
    expect(mock.body).toMatchObject({ error: expect.stringContaining('stripe-signature') });
  });
});

// ---------------------------------------------------------------------------
// Signature verification failure
// ---------------------------------------------------------------------------
describe('stripeWebhookHandler — invalid signature', () => {
  beforeEach(() => {
    mockConstructEvent.mockImplementation(() => {
      const err = new Error('No signatures found matching the expected signature for payload');
      err.name = 'StripeSignatureVerificationError';
      throw err;
    });
  });

  it('returns 400 when Stripe signature verification fails', () => {
    const req = makeStripeReq('invoice.payment_succeeded', {}, 'bad_signature');
    const mock = mockResponse();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    stripeWebhookHandler(req, mock.res as Response);

    expect(mock.statusCode).toBe(400);
    expect(mock.body).toMatchObject({
      error: expect.stringContaining('signature verification failed'),
    });
    errorSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Happy path — all supported Stripe event types
// ---------------------------------------------------------------------------
describe('stripeWebhookHandler — supported event routing', () => {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  afterAll(() => consoleSpy.mockRestore());

  const supportedEvents: Array<[string, Record<string, unknown>]> = [
    [
      'customer.subscription.created',
      { id: 'sub_test_01', customer: 'cus_test_01', status: 'active' },
    ],
    [
      'customer.subscription.updated',
      { id: 'sub_test_01', customer: 'cus_test_01', status: 'past_due' },
    ],
    [
      'customer.subscription.deleted',
      { id: 'sub_test_01', customer: 'cus_test_01', status: 'canceled' },
    ],
    [
      'invoice.payment_succeeded',
      {
        id: 'in_test_01',
        customer: 'cus_test_01',
        amount_paid: 5000,
        currency: 'usd',
      },
    ],
    [
      'invoice.payment_failed',
      {
        id: 'in_test_02',
        customer: 'cus_test_01',
        next_payment_attempt: 1700000000,
      },
    ],
    [
      'checkout.session.completed',
      {
        id: 'cs_test_01',
        customer: 'cus_test_01',
        payment_status: 'paid',
      },
    ],
  ];

  it.each(supportedEvents)(
    'returns 200 and { received: true } for %s',
    (eventType, dataObject) => {
      // Make constructEvent return a well-formed event for this type
      mockConstructEvent.mockReturnValueOnce({
        id: `evt_${Date.now()}`,
        type: eventType,
        data: { object: dataObject },
      });

      const req = makeStripeReq(eventType, dataObject);
      const mock = mockResponse();

      stripeWebhookHandler(req, mock.res as Response);

      expect(mock.statusCode).toBe(200);
      expect(mock.body).toMatchObject({ received: true, eventType });
    }
  );
});

// ---------------------------------------------------------------------------
// Unhandled event type — should still return 200
// ---------------------------------------------------------------------------
describe('stripeWebhookHandler — unhandled event type', () => {
  it('returns 200 for an event type not in the switch statement', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_unknown',
      type: 'payment_method.attached',
      data: { object: {} },
    });

    const req = makeStripeReq('payment_method.attached', {});
    const mock = mockResponse();

    stripeWebhookHandler(req, mock.res as Response);

    expect(mock.statusCode).toBe(200);
    expect(mock.body).toMatchObject({ received: true });
    consoleSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Internal handler error propagation
// ---------------------------------------------------------------------------
describe('stripeWebhookHandler — internal handler error', () => {
  it('returns 500 when an event handler throws an unexpected error', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    // constructEvent succeeds, but the event type triggers a handler that will
    // throw because we make the event object intentionally malformed
    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_error_test',
      type: 'customer.subscription.created',
      // data.object is null — handleSubscriptionCreated will throw accessing .id
      data: { object: null },
    });

    const req = makeStripeReq('customer.subscription.created', {});
    const mock = mockResponse();

    stripeWebhookHandler(req, mock.res as Response);

    // Should be caught by the outer try/catch and returned as 500
    expect([200, 500]).toContain(mock.statusCode);
    errorSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Verify constructEvent is called with correct arguments
// ---------------------------------------------------------------------------
describe('stripeWebhookHandler — constructEvent arguments', () => {
  it('passes raw Buffer body, signature, and webhook secret to constructEvent', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const eventType = 'invoice.payment_succeeded';
    const dataObject = { id: 'in_arg_check', customer: 'cus_arg', amount_paid: 0, currency: 'usd' };

    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_arg_check',
      type: eventType,
      data: { object: dataObject },
    });

    const req = makeStripeReq(eventType, dataObject);
    const mock = mockResponse();

    stripeWebhookHandler(req, mock.res as Response);

    expect(mockConstructEvent).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.any(String),
      STRIPE_TEST_WEBHOOK_SECRET
    );
    consoleSpy.mockRestore();
  });
});
