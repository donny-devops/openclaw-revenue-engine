/**
 * tests/helpers/fixtures.ts
 *
 * Shared test fixtures and factory helpers for the OpenClaw Revenue Engine
 * test suite. All helpers are pure functions — no side effects, no I/O.
 */
import crypto from 'crypto';
import type { Request, Response } from 'express';

// ---------------------------------------------------------------------------
// Stripe fixture helpers
// ---------------------------------------------------------------------------

export const STRIPE_TEST_SECRET_KEY = 'sk_test_fixture_key_00000000000000';
export const STRIPE_TEST_WEBHOOK_SECRET = 'whsec_test_fixture_secret_00000000';
export const GITHUB_TEST_WEBHOOK_SECRET = 'github_test_fixture_secret_00000000';

/**
 * Builds a minimal Stripe event object (raw JSON Buffer) and its
 * HMAC-SHA256 Stripe-Signature header so tests can call
 * stripeWebhookHandler with a validly-signed payload without hitting
 * the real Stripe API.
 */
export function buildStripePayload(
  eventType: string,
  dataObject: Record<string, unknown> = {},
  secret: string = STRIPE_TEST_WEBHOOK_SECRET
): { body: Buffer; signature: string } {
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = JSON.stringify({
    id: `evt_test_${Date.now()}`,
    object: 'event',
    type: eventType,
    livemode: false,
    created: timestamp,
    data: { object: dataObject },
  });

  const body = Buffer.from(payload, 'utf8');
  const signed = `${timestamp}.${payload}`;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(signed);
  const sig = `t=${timestamp},v1=${hmac.digest('hex')}`;

  return { body, signature: sig };
}

/**
 * Builds a GitHub webhook payload (raw JSON Buffer) and its
 * X-Hub-Signature-256 header using HMAC-SHA256.
 */
export function buildGitHubPayload(
  event: string,
  payload: Record<string, unknown> = {},
  secret: string = GITHUB_TEST_WEBHOOK_SECRET
): { body: Buffer; signature: string; event: string; delivery: string } {
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(body);
  const signature = `sha256=${hmac.digest('hex')}`;
  const delivery = `test-delivery-${Date.now()}`;
  return { body, signature, event, delivery };
}

// ---------------------------------------------------------------------------
// Express mock helpers
// ---------------------------------------------------------------------------

export type MockResponse = {
  statusCode: number;
  body: unknown;
  res: Partial<Response>;
};

/**
 * Creates a minimal Express-compatible mock Request.
 */
export function mockRequest(
  overrides: Partial<{
    body: unknown;
    headers: Record<string, string>;
    path: string;
    method: string;
  }> = {}
): Partial<Request> {
  return {
    body: overrides.body ?? {},
    headers: overrides.headers ?? {},
    path: overrides.path ?? '/',
    method: overrides.method ?? 'GET',
    get(name: string) {
      return (this.headers as Record<string, string>)[name.toLowerCase()];
    },
  } as unknown as Partial<Request>;
}

/**
 * Creates a mock Express Response that captures status + json calls.
 */
export function mockResponse(): MockResponse {
  const captured: MockResponse = {
    statusCode: 200,
    body: undefined,
    res: {},
  };

  const res: Partial<Response> = {
    status(code: number) {
      captured.statusCode = code;
      return res as Response;
    },
    json(body: unknown) {
      captured.body = body;
      return res as Response;
    },
    send(body: unknown) {
      captured.body = body;
      return res as Response;
    },
  };

  captured.res = res;
  return captured;
}

// ---------------------------------------------------------------------------
// Domain model factories
// ---------------------------------------------------------------------------

import {
  BillingPlan,
  InvoiceStatus,
  SubscriptionStatus,
  UsageMetricType,
  type Tenant,
  type Invoice,
  type Subscription,
  type UsageRecord,
} from '../../src/models';

export function makeTenant(overrides: Partial<Tenant> = {}): Tenant {
  return {
    id: 'tenant_01',
    name: 'Acme Corp',
    email: 'billing@acme.com',
    billingPlan: BillingPlan.Pro,
    stripeCustomerId: 'cus_test_acme',
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'inv_01',
    tenantId: 'tenant_01',
    stripeInvoiceId: 'in_test_01',
    status: InvoiceStatus.Paid,
    amountDue: 5000,
    amountPaid: 5000,
    currency: 'usd',
    periodStart: new Date('2025-01-01T00:00:00Z'),
    periodEnd: new Date('2025-01-31T23:59:59Z'),
    lineItems: [],
    pdfUrl: null,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function makeSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'sub_01',
    tenantId: 'tenant_01',
    stripeSubscriptionId: 'sub_test_01',
    plan: BillingPlan.Pro,
    status: SubscriptionStatus.Active,
    currentPeriodStart: new Date('2025-01-01T00:00:00Z'),
    currentPeriodEnd: new Date('2025-02-01T00:00:00Z'),
    cancelAtPeriodEnd: false,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function makeUsageRecord(overrides: Partial<UsageRecord> = {}): UsageRecord {
  return {
    id: 'usage_01',
    tenantId: 'tenant_01',
    metricType: UsageMetricType.ApiCall,
    quantity: 42,
    unit: 'requests',
    recordedAt: new Date('2025-01-15T12:00:00Z'),
    metadata: {},
    ...overrides,
  };
}
