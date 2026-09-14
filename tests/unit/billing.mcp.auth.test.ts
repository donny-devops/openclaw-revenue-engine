import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';

import { requireOperatorAuth } from '../../src/middleware/auth';
import { redactSecrets } from '../../src/security/redact';
import { assignAgents, listEnabledAgents } from '../../src/agents/orchestrator';
import {
  createPayment,
  getEarningsSnapshot,
  markPaymentStatus,
  recordInvoicePayment,
  rememberStripeEvent,
  resetLedger,
} from '../../src/billing/ledger';
import { createLaneCheckout, simulatePaymentCollection } from '../../src/billing/checkout';
import { getUsageSummary, recordUsageEvent, resetUsageMeter } from '../../src/billing/usageMeter';
import { handleMcpRequest, listMcpTools } from '../../src/mcp/server';
import { mockResponse } from '../helpers/fixtures';

describe('secret redaction', () => {
  it('redacts stripe keys, webhook secrets, and bearer tokens', () => {
    const raw = 'sk_test_abc123 whsec_hello Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.a.b';
    expect(redactSecrets(raw)).not.toContain('sk_test_abc123');
    expect(redactSecrets(raw)).toContain('[REDACTED]');
  });
});

describe('agent orchestrator', () => {
  it('assigns a primary agent and supporting subagents', () => {
    const plan = assignAgents('actions-debug');
    expect(plan.primary.slug).toBe('swe-remediation-agent');
    expect(plan.supporting.length).toBeGreaterThan(0);
    expect(listEnabledAgents().map((agent) => agent.slug)).toEqual(
      expect.arrayContaining(['revenue-intake-orchestrator', 'config-agent']),
    );
  });
});

describe('billing ledger and usage', () => {
  beforeEach(() => {
    resetLedger();
    resetUsageMeter();
  });

  it('records checkout collection and earnings', () => {
    const payment = createPayment({
      lane: 'detailed-request',
      service: 'repo-triage',
      amount_cents: 2900,
      currency: 'usd',
      customer_email: 'buyer@example.com',
      simulated: true,
    });
    markPaymentStatus(payment.id, 'paid');
    const earnings = getEarningsSnapshot();
    expect(earnings.collected_count).toBe(1);
    expect(earnings.collected_cents).toBe(2900);
    expect(earnings.collected_usd).toBe(29);
  });

  it('filters earnings snapshots by currency', () => {
    const usdPayment = createPayment({
      lane: 'detailed-request',
      service: 'repo-triage',
      amount_cents: 2900,
      currency: 'usd',
      simulated: true,
    });
    const eurPayment = createPayment({
      lane: 'detailed-request',
      service: 'repo-triage',
      amount_cents: 4100,
      currency: 'eur',
      simulated: true,
    });

    markPaymentStatus(usdPayment.id, 'paid');
    markPaymentStatus(eurPayment.id, 'paid');

    expect(getEarningsSnapshot('usd')).toMatchObject({ currency: 'usd', collected_cents: 2900, payments: 1 });
    expect(getEarningsSnapshot('eur')).toMatchObject({
      currency: 'eur',
      collected_cents: 4100,
      collected_usd: 0,
      payments: 1,
    });
  });

  it('is idempotent for stripe events and invoice payments', () => {
    expect(rememberStripeEvent('evt_1')).toBe(true);
    expect(rememberStripeEvent('evt_1')).toBe(false);
    const first = recordInvoicePayment({
      stripe_invoice_id: 'in_1',
      amount_cents: 4900,
      currency: 'usd',
      status: 'paid',
    });
    const second = recordInvoicePayment({
      stripe_invoice_id: 'in_1',
      amount_cents: 4900,
      currency: 'usd',
      status: 'paid',
    });
    expect(second.id).toBe(first.id);
    expect(getEarningsSnapshot().collected_count).toBe(1);
  });

  it('records usage events idempotently', () => {
    const event = recordUsageEvent({
      tenant_id: 'tenant_1',
      metric_type: 'api_call',
      quantity: 3,
      idempotency_key: 'abc',
    });
    const replay = recordUsageEvent({
      tenant_id: 'tenant_1',
      metric_type: 'api_call',
      quantity: 99,
      idempotency_key: 'abc',
    });
    expect(replay.id).toBe(event.id);
    expect(getUsageSummary('tenant_1').totals_by_metric.api_call).toBe(3);
  });

  it('scopes idempotency keys by tenant and metric', () => {
    const first = recordUsageEvent({
      tenant_id: 'tenant_1',
      metric_type: 'api_call',
      quantity: 3,
      idempotency_key: 'shared',
    });
    const crossTenant = recordUsageEvent({
      tenant_id: 'tenant_2',
      metric_type: 'api_call',
      quantity: 7,
      idempotency_key: 'shared',
    });
    const crossMetric = recordUsageEvent({
      tenant_id: 'tenant_1',
      metric_type: 'agent_run',
      quantity: 5,
      idempotency_key: 'shared',
    });

    expect(crossTenant.id).not.toBe(first.id);
    expect(crossMetric.id).not.toBe(first.id);
    expect(getUsageSummary('tenant_1').totals_by_metric).toMatchObject({ api_call: 3, agent_run: 5 });
    expect(getUsageSummary('tenant_2').totals_by_metric.api_call).toBe(7);
  });
});

describe('checkout collection', () => {
  beforeEach(() => {
    resetLedger();
    process.env.NODE_ENV = 'test';
    process.env.STRIPE_SECRET_KEY = 'sk_test_fixture_key_00000000000000';
  });

  it('creates a simulated checkout session and collects payment locally', async () => {
    const result = await createLaneCheckout({
      body: 'Please review my GitHub portfolio repository and README.',
      customer_email: 'buyer@example.com',
    });
    expect(result.simulated).toBe(true);
    expect(result.payment.status).toBe('pending');
    expect(result.classification.assigned_agent?.slug).toBe('swe-remediation-agent');
    const paid = simulatePaymentCollection(result.payment.id);
    expect(paid.status).toBe('paid');
  });
});

describe('operator auth', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  function run(req: Partial<Request>) {
    const captured = mockResponse();
    let nextCalled = false;
    const next = (() => {
      nextCalled = true;
    }) as NextFunction;
    requireOperatorAuth(req as Request, captured.res as Response, next);
    return { captured, nextCalled };
  }

  it('allows unauthenticated access when credentials are unset outside production', () => {
    delete process.env.OPERATOR_API_KEY;
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = 'test';
    const result = run({ headers: {} });
    expect(result.nextCalled).toBe(true);
  });

  it('accepts a matching operator API key', () => {
    process.env.OPERATOR_API_KEY = 'operator-secret';
    const result = run({ headers: { authorization: 'Bearer operator-secret' } });
    expect(result.nextCalled).toBe(true);
  });

  it('accepts a valid JWT', () => {
    process.env.JWT_SECRET = 'jwt-secret-value';
    delete process.env.OPERATOR_API_KEY;
    const token = jwt.sign({ sub: 'operator' }, 'jwt-secret-value');
    const result = run({ headers: { authorization: `Bearer ${token}` } });
    expect(result.nextCalled).toBe(true);
  });

  it('rejects a missing bearer token when auth is configured', () => {
    process.env.OPERATOR_API_KEY = 'operator-secret';
    const result = run({ headers: {} });
    expect(result.nextCalled).toBe(false);
    expect(result.captured.statusCode).toBe(401);
  });
});

describe('MCP server', () => {
  beforeEach(() => {
    resetLedger();
  });

  it('lists tools and classifies paid requests', async () => {
    const listed = await handleMcpRequest({ method: 'tools/list', id: 1 });
    expect(listMcpTools().map((tool) => tool.name)).toEqual(
      expect.arrayContaining(['create_checkout']),
    );
    expect(listMcpTools().map((tool) => tool.name)).not.toEqual(
      expect.arrayContaining(['get_earnings', 'list_payments']),
    );
    expect(listed.result).toMatchObject({ tools: expect.any(Array) });

    const classified = await handleMcpRequest({
      method: 'tools/call',
      id: 2,
      params: {
        name: 'classify_paid_request',
        arguments: { body: 'Please debug my GitHub Actions workflow YAML.' },
      },
    });
    expect(classified.error).toBeUndefined();
  });

  it('creates checkout through the MCP tool', async () => {
    const result = await handleMcpRequest({
      method: 'tools/call',
      id: 3,
      params: {
        name: 'create_checkout',
        arguments: {
          body: 'Please review my GitHub portfolio repository and README.',
          customer_email: 'buyer@example.com',
        },
      },
    });
    expect(result.error).toBeUndefined();
    expect(result.result).toMatchObject({
      structuredContent: expect.objectContaining({ simulated: true }),
    });
  });
});
