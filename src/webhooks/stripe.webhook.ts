import { Request, Response } from 'express';
import Stripe from 'stripe';

// ─── Bug 5 fix: fail fast at module load if required env vars are missing ───
// Previously used `as string` casts which silently allowed undefined values,
// causing cryptic Stripe SDK errors at request time instead of a clear startup failure.
function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

const stripe = new Stripe(requireEnv('STRIPE_SECRET_KEY'), {
  apiVersion: '2024-06-20',
});

const webhookSecret = requireEnv('STRIPE_WEBHOOK_SECRET');

/**
 * Stripe Webhook Handler
 *
 * Verifies the Stripe signature, then routes each event type
 * to its appropriate handler. Uses raw body for HMAC verification.
 *
 * IMPORTANT: This handler must be registered with express.raw({ type: 'application/json' })
 * in index.ts BEFORE the global express.json() middleware. The raw Buffer is
 * required by stripe.webhooks.constructEvent() for HMAC signature verification.
 * If json() runs first, req.body will be a parsed object and verification always fails.
 *
 * Supported events:
 *   - customer.subscription.created
 *   - customer.subscription.updated
 *   - customer.subscription.deleted
 *   - invoice.payment_succeeded
 *   - invoice.payment_failed
 *   - checkout.session.completed
 */
export async function stripeWebhookHandler(
  req: Request,
  res: Response
): Promise<void> {
  const sig = req.headers['stripe-signature'];

  if (!sig) {
    res.status(400).json({ error: 'Missing stripe-signature header' });
    return;
  }

  let event: Stripe.Event;

  try {
    // req.body is a raw Buffer here because express.raw() is applied to this
    // route before express.json() in index.ts (Bug 3 fix)
    event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      sig,
      webhookSecret
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Stripe webhook signature verification failed: ${message}`);
    res.status(400).json({ error: `Webhook signature verification failed: ${message}` });
    return;
  }

  console.log(`Stripe webhook received: ${event.type} [${event.id}]`);

  try {
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      default:
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }

    res.status(200).json({ received: true, eventType: event.type });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Error processing Stripe webhook ${event.type}: ${message}`);
    res.status(500).json({ error: 'Internal webhook processing error' });
  }
}

// ---------------------------------------------------------------------------
// Event Handlers
// ---------------------------------------------------------------------------

async function handleSubscriptionCreated(
  subscription: Stripe.Subscription
): Promise<void> {
  console.log(`New subscription created: ${subscription.id}`);
  console.log(`Customer: ${subscription.customer as string}`);
  console.log(`Status: ${subscription.status}`);
  // TODO: Provision access, update DB, send welcome email
}

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
): Promise<void> {
  console.log(`Subscription updated: ${subscription.id}`);
  console.log(`New status: ${subscription.status}`);
  // TODO: Update access level, sync plan changes to DB
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  console.log(`Subscription cancelled: ${subscription.id}`);
  console.log(`Customer: ${subscription.customer as string}`);
  // TODO: Revoke access, update DB, send cancellation confirmation
}

async function handlePaymentSucceeded(
  invoice: Stripe.Invoice
): Promise<void> {
  console.log(`Payment succeeded for invoice: ${invoice.id}`);
  console.log(`Amount: ${invoice.amount_paid} ${invoice.currency}`);
  console.log(`Customer: ${invoice.customer as string}`);
  // TODO: Record payment in DB, generate internal invoice record
}

async function handlePaymentFailed(
  invoice: Stripe.Invoice
): Promise<void> {
  console.log(`Payment failed for invoice: ${invoice.id}`);
  console.log(`Customer: ${invoice.customer as string}`);
  console.log(`Next retry: ${invoice.next_payment_attempt ?? 'none'}`);
  // TODO: Send payment failure alert, flag account for retry
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  console.log(`Checkout session completed: ${session.id}`);
  console.log(`Customer: ${session.customer as string}`);
  console.log(`Payment status: ${session.payment_status}`);
  // TODO: Activate subscription, send onboarding email
}
