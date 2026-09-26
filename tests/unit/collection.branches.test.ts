import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';

import { requireOperatorAuth } from '../../src/middleware/auth';
import { getAgent } from '../../src/agents/orchestrator';
import { createLaneCheckout, simulatePaymentCollection } from '../../src/billing/checkout';
import {
  createPayment,
  findPaymentByStripeSession,
  resetLedger,
  updatePayment,
} from '../../src/billing/ledger';
import { recordUsageEvent, resetUsageMeter } from '../../src/billing/usageMeter';
import { resetStripeClient } from '../../src/billing/stripeClient';
import { handleMcpRequest } from '../../src/mcp/server';
import { operatorAuthHeaders } from '../helpers/operatorAuth';
import { mockResponse } from '../helpers/fixtures';

const mockCreateSession = jest.fn();

jest.mock('stripe', () =>
  jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: (...args: unknown[]) => mockCreateSession(...args),
      },
    },
    webhooks: { constructEvent: jest.fn() },
  })),
);

beforeAll(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_live_checkout_key_123456';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_live_checkout_placeholder';
  process.env.GITHUB_WEBHOOK_SECRET = 'github_live_checkout_placeholder';
  process.env.OPERATOR_API_KEY ??= 'test_operator_api_key';
  process.env.LOG_LEVEL = 'silent';
});

import app from '../../src/index';

describe('live Stripe checkout and error branches', () => {
  beforeEach(() => {
    resetLedger();
    resetUsageMeter();
    resetStripeClient();
    mockCreateSession.mockReset();
    process.env.STRIPE_MODE = 'live';
    process.env.NODE_ENV = 'test';
    process.env.STRIPE_SECRET_KEY = 'sk_test_live_checkout_key_123456';
  });

  afterEach(() => {
    process.env.STRIPE_MODE = 'simulated';
    process.env.NODE_ENV = 'test';
  });

  it('creates a live Stripe Checkout session', async () => {
    mockCreateSession.mockResolvedValueOnce({
      id: 'cs_live_1',
      url: 'https://checkout.stripe.com/c/pay/cs_live_1',
    });

    const result = await createLaneCheckout({
      body: 'Please review my GitHub portfolio repository and README.',
      customer_email: 'buyer@example.com',
    });

    expect(result.simulated).toBe(false);
    expect(result.checkout_url).toContain('checkout.stripe.com');
    expect(findPaymentByStripeSession('cs_live_1')?.id).toBe(result.payment.id);
    expect(mockCreateSession).toHaveBeenCalled();
  });

  it('rejects checkout requests without a customer email', async () => {
    await expect(
      createLaneCheckout({
        body: 'Please review my GitHub portfolio repository and README.',
        customer_email: '   ',
      }),
    ).rejects.toThrow('customer_email is required');
  });

  it('rejects a live session that has no checkout URL', async () => {
    mockCreateSession.mockResolvedValueOnce({ id: 'cs_missing_url' });
    await expect(
      createLaneCheckout({
        body: 'Please review my GitHub portfolio repository and README.',
        customer_email: 'buyer@example.com',
      }),
    ).rejects.toThrow('Stripe did not return a checkout URL');
  });

  it('rejects simulated collection in production and for live payments', async () => {
    const live = createPayment({
      lane: 'small-request',
      service: 'repo-triage',
      amount_cents: 1900,
      currency: 'usd',
      simulated: false,
    });
    expect(() => simulatePaymentCollection(live.id)).toThrow('Only simulated payments');
    expect(() => simulatePaymentCollection('pay_missing')).toThrow('Unknown payment');

    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    expect(() => simulatePaymentCollection(live.id)).toThrow('disabled in production');
    process.env.NODE_ENV = original;
  });

  it('returns 404 for unknown payments and 400 for invalid usage', async () => {
    const missing = await request(app).get('/revenue/payments/pay_missing');
    expect(missing.status).toBe(404);

    const collect = await request(app)
      .post('/revenue/payments/pay_missing/collect')
      .set(operatorAuthHeaders());
    expect([400, 404]).toContain(collect.status);

    const usage = await request(app).post('/usage/events').set(operatorAuthHeaders()).send({ tenant_id: 't1' });
    expect(usage.status).toBe(400);

    const classify = await request(app).post('/revenue/classify').send({
      body: 'Please review my GitHub portfolio repository and README.',
      service: 'does-not-exist',
    });
    expect(classify.status).toBe(400);
  });

  it('covers MCP initialize, catalog tools, and error paths', async () => {
    const init = await handleMcpRequest({ method: 'initialize', id: 'init' });
    expect(init.result).toMatchObject({ protocolVersion: '2024-11-05' });

    await expect(handleMcpRequest({ method: 'tools/call', id: 1, params: {} })).resolves.toMatchObject({
      error: expect.objectContaining({ message: expect.stringContaining('Tool name') }),
    });

    const lanes = await handleMcpRequest({ method: 'tools/call', id: 2, params: { name: 'list_lanes' } });
    const services = await handleMcpRequest({ method: 'tools/call', id: 3, params: { name: 'list_services' } });
    const agents = await handleMcpRequest({ method: 'tools/call', id: 4, params: { name: 'list_agents' } });
    const earnings = await handleMcpRequest({ method: 'tools/call', id: 5, params: { name: 'get_earnings' } });
    const payments = await handleMcpRequest({ method: 'tools/call', id: 6, params: { name: 'list_payments' } });
    const unknown = await handleMcpRequest({ method: 'tools/call', id: 7, params: { name: 'nope' } });
    const badMethod = await handleMcpRequest({ method: 'not-a-method', id: 8 });
    const mcpHttp = await request(app).post('/mcp').set(operatorAuthHeaders()).send({ jsonrpc: '2.0', id: 1 });

    expect(lanes.error).toBeUndefined();
    expect(services.error).toBeUndefined();
    expect(agents.error).toBeUndefined();
    expect(earnings.error).toBeUndefined();
    expect(payments.error).toBeUndefined();
    expect(unknown.error?.message).toContain('Unknown MCP tool');
    expect(badMethod.error?.message).toContain('Unsupported MCP method');
    expect(mcpHttp.status).toBe(400);
  });
});

describe('auth and ledger error branches', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  function run(req: Partial<Request>) {
    const captured = mockResponse();
    let nextCalled = false;
    requireOperatorAuth(req as Request, captured.res as Response, (() => {
      nextCalled = true;
    }) as NextFunction);
    return { captured, nextCalled };
  }

  it('fails closed in production when operator auth is not configured', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.OPERATOR_API_KEY;
    delete process.env.JWT_SECRET;
    const result = run({ headers: {} });
    expect(result.nextCalled).toBe(false);
    expect(result.captured.statusCode).toBe(503);
  });

  it('rejects invalid JWTs and mismatched API keys', () => {
    process.env.OPERATOR_API_KEY = 'expected-key';
    expect(run({ headers: { authorization: 'Bearer different-key' } }).captured.statusCode).toBe(401);

    delete process.env.OPERATOR_API_KEY;
    process.env.JWT_SECRET = 'jwt-secret-value';
    expect(run({ headers: { authorization: 'Bearer not-a-jwt' } }).captured.statusCode).toBe(401);
    const token = jwt.sign({ sub: 'op' }, 'wrong-secret');
    expect(run({ headers: { authorization: `Bearer ${token}` } }).captured.statusCode).toBe(401);
  });

  it('throws on unknown ledger updates and usage validation errors', () => {
    expect(() => updatePayment('missing', { status: 'paid' })).toThrow('Unknown payment');
    expect(() => getAgent('missing-agent')).toThrow('Unknown or disabled agent');
    expect(() => recordUsageEvent({ tenant_id: ' ', metric_type: 'api_call', quantity: 1 })).toThrow('tenant_id');
    expect(() => recordUsageEvent({ tenant_id: 't1', metric_type: '', quantity: 1 })).toThrow('metric_type');
    expect(() => recordUsageEvent({ tenant_id: 't1', metric_type: 'api_call', quantity: -1 })).toThrow('quantity');
  });
});
