import type { Request, Response } from 'express';
import crypto from 'crypto';

import { clerkWebhookHandler, resetClerkEventMemory } from '../../src/webhooks/clerk.webhook';
import { findMerchantByOrgId, resetMerchantStore } from '../../src/services/merchant.service';

const TEST_SECRET = 'whsec_test_fixture_placeholder_00000000';
const TEST_INTERNAL_SECRET = 'mesh_internal_secret_key_placeholder';

function mockResponse() {
  const res: any = {};
  res.statusCode = 200;
  res.body = null;
  res.status = function (code: number) {
    res.statusCode = code;
    return res;
  };
  res.json = function (payload: any) {
    res.body = payload;
    return res;
  };
  return res;
}

function makeSvixRequest(
  payloadObj: Record<string, any>,
  secret: string = TEST_SECRET,
  customHeaders: Record<string, string> = {}
): Request {
  const rawBody = Buffer.from(JSON.stringify(payloadObj));
  const svixId = customHeaders['svix-id'] || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const svixTimestamp = customHeaders['svix-timestamp'] || String(Math.floor(Date.now() / 1000));

  const cleanSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  const secretKey = Buffer.from(cleanSecret, 'base64');
  const hmac = crypto.createHmac('sha256', secretKey);
  hmac.update(`${svixId}.${svixTimestamp}.${rawBody.toString('utf-8')}`);
  const sig = hmac.digest('base64');

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'svix-id': svixId,
    'svix-timestamp': svixTimestamp,
    'svix-signature': `v1,${sig}`,
    ...customHeaders,
  };

  return {
    body: rawBody,
    headers,
  } as unknown as Request;
}

describe('Clerk Webhook Handler — OpenClaw Revenue Engine', () => {
  beforeAll(() => {
    process.env.CLERK_WEBHOOK_SIGNING_SECRET = TEST_SECRET;
    process.env.INTERNAL_SERVICE_SECRET = TEST_INTERNAL_SECRET;
    process.env.STRIPE_MODE = 'simulated';
  });

  beforeEach(() => {
    resetMerchantStore();
    resetClerkEventMemory();
  });

  it('rejects requests missing Svix signature headers', async () => {
    const req = {
      body: Buffer.from(JSON.stringify({ type: 'user.created' })),
      headers: {},
    } as unknown as Request;
    const res = mockResponse();

    await clerkWebhookHandler(req, res as Response);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('signature verification failed');
  });

  it('rejects requests with invalid Svix signature', async () => {
    const req = makeSvixRequest(
      { type: 'user.created' },
      TEST_SECRET,
      { 'svix-signature': 'v1,invalid_signature_base64=' }
    );
    const res = mockResponse();

    await clerkWebhookHandler(req, res as Response);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('signature verification failed');
  });

  it('provisions merchant and creates Stripe customer on organizationMembership.created', async () => {
    const orgId = 'org_enterprise_9988';
    const userId = 'user_clerk_lead_11';
    const payload = {
      type: 'organizationMembership.created',
      data: {
        organization: { id: orgId, name: 'Acme SaaS Corp' },
        public_user_data: {
          user_id: userId,
          first_name: 'John',
          last_name: 'Doe',
          identifier: 'john.doe@acme.com',
        },
        role: 'org:admin',
      },
    };

    const req = makeSvixRequest(payload);
    const res = mockResponse();

    await clerkWebhookHandler(req, res as Response);

    expect(res.statusCode).toBe(200);
    expect(res.body.received).toBe(true);
    expect(res.body.eventType).toBe('organizationMembership.created');
    expect(res.body.merchantId).toBeDefined();
    expect(res.body.stripeCustomerId).toBeDefined();

    const merchant = findMerchantByOrgId(orgId);
    expect(merchant).toBeDefined();
    expect(merchant?.clerkUserId).toBe(userId);
    expect(merchant?.role).toBe('org:admin');
    expect(merchant?.status).toBe('ACTIVE');
    expect(merchant?.stripeCustomerId).toBeDefined();
  });

  it('activates merchant subscription on subscription.created', async () => {
    const orgId = 'org_sub_target_55';
    const payload = {
      type: 'subscription.created',
      data: {
        id: 'sub_live_994411',
        org_id: orgId,
        status: 'active',
        tier: 'enterprise-unlimited',
      },
    };

    const req = makeSvixRequest(payload);
    const res = mockResponse();

    await clerkWebhookHandler(req, res as Response);

    expect(res.statusCode).toBe(200);
    expect(res.body.received).toBe(true);
    expect(res.body.subscriptionId).toBe('sub_live_994411');

    const merchant = findMerchantByOrgId(orgId);
    expect(merchant).toBeDefined();
    expect(merchant?.subscriptionId).toBe('sub_live_994411');
    expect(merchant?.subscriptionTier).toBe('enterprise-unlimited');
    expect(merchant?.subscriptionStatus).toBe('active');
  });

  it('deduplicates duplicate event deliveries idempotently', async () => {
    const payload = {
      type: 'organizationMembership.created',
      data: {
        organization: { id: 'org_dedup_1' },
        public_user_data: { user_id: 'user_dedup_1' },
        role: 'org:member',
      },
    };

    const req1 = makeSvixRequest(payload, TEST_SECRET, { 'svix-id': 'fixed_msg_id_101' });
    const res1 = mockResponse();
    await clerkWebhookHandler(req1, res1 as Response);
    expect(res1.statusCode).toBe(200);
    expect(res1.body.duplicate).toBeUndefined();

    // Replay same msg_id
    const req2 = makeSvixRequest(payload, TEST_SECRET, { 'svix-id': 'fixed_msg_id_101' });
    const res2 = mockResponse();
    await clerkWebhookHandler(req2, res2 as Response);
    expect(res2.statusCode).toBe(200);
    expect(res2.body.duplicate).toBe(true);
  });

  it('accepts mutual zero-trust x-service-signature forwarded from Cloudflare edge', async () => {
    const payload = {
      type: 'organizationMembership.created',
      data: {
        organization: { id: 'org_edge_forwarded_77' },
        public_user_data: { user_id: 'user_edge_77' },
        role: 'org:admin',
      },
    };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const hmac = crypto.createHmac('sha256', TEST_INTERNAL_SECRET);
    hmac.update(rawBody.toString('utf-8'));
    const serviceSig = hmac.digest('hex');

    const req = {
      body: rawBody,
      headers: {
        'content-type': 'application/json',
        'x-service-signature': `sha256=${serviceSig}`,
      },
    } as unknown as Request;
    const res = mockResponse();

    await clerkWebhookHandler(req, res as Response);
    expect(res.statusCode).toBe(200);
    expect(res.body.received).toBe(true);
    expect(findMerchantByOrgId('org_edge_forwarded_77')).toBeDefined();
  });
});
