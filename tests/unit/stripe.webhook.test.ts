import type { Request, Response } from 'express';

import { createPayment, getPayment, recordInvoicePayment, rememberStripeEvent, resetLedger } from '../../src/billing/ledger';
import { buildStripePayload, mockResponse } from '../helpers/fixtures';
import { stripeWebhookHandler } from '../../src/webhooks/stripe.webhook';

jest.mock('../../src/billing/ledger', () => {
  const actual = jest.requireActual('../../src/billing/ledger') as typeof import('../../src/billing/ledger');
  return {
    ...actual,
    recordInvoicePayment: jest.fn((input: Parameters<typeof actual.recordInvoicePayment>[0]) =>
      actual.recordInvoicePayment(input),
    ),
  };
});

const invoke = (payload: { body: Buffer; signature?: string }) => {
  const captured = mockResponse();
  stripeWebhookHandler(
    {
      body: payload.body,
      headers: payload.signature !== undefined ? { 'stripe-signature': payload.signature } : {},
    } as unknown as Request,
    captured.res as Response,
  );
  return captured;
};

describe('stripe webhook idempotency', () => {
  beforeEach(() => {
    resetLedger();
    (recordInvoicePayment as jest.Mock).mockImplementation(
      (input: Parameters<typeof recordInvoicePayment>[0]) =>
        jest.requireActual('../../src/billing/ledger').recordInvoicePayment(input),
    );
  });

  it('records an invoice payment and treats a later delivery as a duplicate', () => {
    const payload = buildStripePayload('invoice.payment_succeeded', {
      id: 'in_retry_ok',
      amount_paid: 4900,
      currency: 'usd',
      customer: 'cus_ok',
    });

    const first = invoke(payload);
    const replay = invoke(payload);

    expect(first.statusCode).toBe(200);
    expect(replay.statusCode).toBe(200);
    expect(replay.body).toMatchObject({ duplicate: true });
    expect(jest.requireActual('../../src/billing/ledger').getEarningsSnapshot().collected_cents).toBe(4900);
  });

  it('releases a claimed event when ledger writes fail so Stripe retries can collect', () => {
    (recordInvoicePayment as jest.Mock).mockImplementationOnce(() => {
      throw new Error('ledger write failed');
    });

    const payload = buildStripePayload('invoice.payment_succeeded', {
      id: 'in_retry_fail',
      amount_paid: 2900,
      currency: 'usd',
      customer: 'cus_retry',
    });

    const failed = invoke(payload);
    expect(failed.statusCode).toBe(500);

    const retried = invoke(payload);
    expect(retried.statusCode).toBe(200);
    expect(retried.body).not.toMatchObject({ duplicate: true });
    expect(jest.requireActual('../../src/billing/ledger').getEarningsSnapshot().collected_cents).toBe(2900);
  });

  it('returns 409 for an in-flight duplicate instead of ACKing', () => {
    const payload = buildStripePayload('invoice.payment_succeeded', {
      id: 'in_in_flight',
      amount_paid: 1900,
      currency: 'usd',
      customer: 'cus_in_flight',
    });
    const eventId = (JSON.parse(payload.body.toString()) as { id: string }).id;
    expect(rememberStripeEvent(eventId)).toBe(true);

    const result = invoke(payload);
    expect(result.statusCode).toBe(409);
    expect(result.body).toMatchObject({ in_flight: true });
    expect(jest.requireActual('../../src/billing/ledger').getEarningsSnapshot().collected_cents).toBe(0);
  });

  it('marks a checkout session paid on a successful delivery', () => {
    const payment = createPayment({
      lane: 'detailed-request',
      service: 'repo-triage',
      amount_cents: 2900,
      currency: 'usd',
      stripe_session_id: 'cs_paid_1',
      simulated: false,
    });
    const payload = buildStripePayload('checkout.session.completed', {
      id: 'cs_paid_1',
      payment_status: 'paid',
      amount_total: 2900,
      currency: 'usd',
      payment_intent: 'pi_paid_1',
      metadata: { payment_id: payment.id },
    });

    const result = invoke(payload);
    expect(result.statusCode).toBe(200);
    expect(getPayment(payment.id)?.status).toBe('paid');
  });
});

describe('stripe webhook security', () => {
  it('returns 400 when stripe-signature is absent', () => {
    const result = invoke({ body: Buffer.from('{}') });

    expect(result.statusCode).toBe(400);
    expect(result.body).toMatchObject({ error: expect.stringContaining('stripe-signature') });
  });

  it('returns 400 when Stripe signature verification fails', () => {
    const payload = buildStripePayload('invoice.payment_succeeded', {
      id: 'in_bad_sig',
      amount_paid: 1000,
      currency: 'usd',
      customer: 'cus_bad_sig',
    });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = invoke({ body: payload.body, signature: 'bad_signature' });

    expect(result.statusCode).toBe(400);
    expect(result.body).toMatchObject({
      error: expect.stringContaining('signature verification failed'),
    });
    errorSpy.mockRestore();
  });

  it('returns 200 for an event type not in the switch statement', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const payload = buildStripePayload('payment_method.attached', {});

    const result = invoke(payload);

    expect(result.statusCode).toBe(200);
    expect(result.body).toMatchObject({ received: true });
    logSpy.mockRestore();
  });
});
