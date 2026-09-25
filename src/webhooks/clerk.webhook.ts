import { Request, Response } from 'express';
import crypto from 'crypto';

import {
  provisionMerchantFromOrgMembership,
  syncMerchantSubscription,
} from '../services/merchant.service';
import { redactSecrets } from '../security/redact';

const processedEvents = new Set<string>();

export function verifySvixSignature(
  rawBody: string | Buffer,
  headers: Record<string, string | string[] | undefined>,
  secret: string | undefined
): boolean {
  const serviceSig = headers['x-service-signature'] as string;
  // No fallback: an unset INTERNAL_SERVICE_SECRET must never validate a
  // request. A previously-hardcoded default here would have let anyone who
  // knew that constant bypass Svix verification entirely.
  const internalSecret = process.env.INTERNAL_SERVICE_SECRET;

  if (serviceSig && internalSecret) {
    const rawBodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf-8') : rawBody;
    const hmac = crypto.createHmac('sha256', internalSecret);
    hmac.update(rawBodyStr);
    const expectedSig = hmac.digest('hex');
    const cleanSig = serviceSig.replace('sha256=', '');
    if (cleanSig.length === expectedSig.length && crypto.timingSafeEqual(Buffer.from(cleanSig), Buffer.from(expectedSig))) {
      return true;
    }
  }

  const svixId = headers['svix-id'] as string;
  const svixTimestamp = headers['svix-timestamp'] as string;
  const svixSignature = headers['svix-signature'] as string;

  if (!svixId || !svixTimestamp || !svixSignature || !secret) {
    return false;
  }

  const rawBodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf-8') : rawBody;
  const toSign = `${svixId}.${svixTimestamp}.${rawBodyStr}`;

  // Handle whsec_ base64 secret or raw secret
  const cleanSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  let secretKey: Buffer;
  try {
    secretKey = Buffer.from(cleanSecret, 'base64');
  } catch {
    secretKey = Buffer.from(cleanSecret, 'utf-8');
  }

  const hmac = crypto.createHmac('sha256', secretKey);
  hmac.update(toSign);
  const expectedSigBase64 = hmac.digest('base64');

  // svix-signature contains space-separated versions e.g. "v1,g0hM9+..."
  const passedSignatures = svixSignature.split(' ');
  for (const versionedSig of passedSignatures) {
    const parts = versionedSig.split(',');
    if (parts.length === 2 && parts[0] === 'v1') {
      const sig = parts[1];
      if (
        sig.length === expectedSigBase64.length &&
        crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSigBase64))
      ) {
        return true;
      }
    }
  }

  return false;
}

export function rememberClerkEvent(eventId: string): boolean {
  if (processedEvents.has(eventId)) {
    return false;
  }
  processedEvents.add(eventId);
  if (processedEvents.size > 10_000) {
    const first = processedEvents.values().next().value;
    if (first) processedEvents.delete(first);
  }
  return true;
}

export function resetClerkEventMemory(): void {
  processedEvents.clear();
}

/**
 * Clerk Inbound Webhook Handler for OpenClaw Revenue Engine.
 *
 * Verifies Svix signatures, provides deduplication, and coordinates
 * merchant provisioning with Stripe customer creation.
 */
export async function clerkWebhookHandler(
  req: Request,
  res: Response
): Promise<void> {
  // No fallback: an unset secret must fail signature verification, not
  // silently validate against a known test value.
  const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  const rawBody = req.body as Buffer;

  if (!secret && !process.env.INTERNAL_SERVICE_SECRET) {
    console.error('Neither CLERK_WEBHOOK_SIGNING_SECRET nor INTERNAL_SERVICE_SECRET is configured — refusing webhook');
    res.status(500).json({ error: 'Webhook verification not configured' });
    return;
  }

  const isValid = verifySvixSignature(rawBody, req.headers, secret);
  if (!isValid) {
    console.error('Clerk webhook signature verification failed');
    res.status(400).json({ error: 'Webhook signature verification failed' });
    return;
  }

  let event: { type: string; data: Record<string, any>; id?: string };
  try {
    event = JSON.parse(rawBody.toString('utf-8'));
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invalid JSON';
    res.status(400).json({ error: `Malformed JSON payload: ${msg}` });
    return;
  }

  const svixId = (req.headers['svix-id'] as string) || event.id || `evt_${Date.now()}`;
  if (!rememberClerkEvent(svixId)) {
    res.status(200).json({ received: true, eventType: event.type, duplicate: true });
    return;
  }

  console.log(`Clerk webhook received: ${event.type} [${svixId}]`);

  try {
    switch (event.type) {
      case 'organizationMembership.created': {
        const org = event.data.organization || {};
        const user = event.data.public_user_data || {};
        const role = event.data.role || 'org:member';

        const merchant = await provisionMerchantFromOrgMembership({
          orgId: org.id || event.data.org_id,
          orgName: org.name,
          userId: user.user_id || event.data.user_id,
          role,
          name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || undefined,
          email: user.identifier,
        });

        res.status(200).json({
          received: true,
          eventType: event.type,
          merchantId: merchant.id,
          stripeCustomerId: merchant.stripeCustomerId,
        });
        return;
      }

      case 'subscription.created':
      case 'customer.subscription.created': {
        const subData = event.data;
        const subId = subData.id || `sub_${Date.now()}`;
        const orgId = subData.metadata?.clerkOrgId || subData.org_id;
        const customerId = subData.customer_id || subData.customer;
        const status = subData.status || 'active';
        const tier = subData.tier || subData.plan?.id || 'pro';

        const updated = await syncMerchantSubscription({
          orgId,
          customerId,
          subscriptionId: subId,
          tier,
          status,
        });

        res.status(200).json({
          received: true,
          eventType: event.type,
          subscriptionId: subId,
          merchantId: updated?.id,
        });
        return;
      }

      default:
        console.log(`Unhandled Clerk event: ${event.type}`);
        res.status(200).json({ received: true, eventType: event.type, status: 'ignored' });
        return;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Error processing Clerk webhook ${event.type}: ${redactSecrets(message)}`);
    res.status(500).json({ error: 'Internal webhook processing error' });
  }
}
