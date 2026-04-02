import { Request, Response } from 'express';
import Stripe from 'stripe';

// ─── Fail fast at module load if required env vars are missing ───
function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
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
 * in index.ts BEFORE the global express.json() middleware.
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
        handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.updated':
        handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_succeeded':
        handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case 'checkout.session.completed':
        handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
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

function handleSubscriptionCreated(subscription: Stripe.Subscription): void {
  console.log(`New subscription created: ${subscription.id}`);
  console.log(`Customer: ${String(subscription.customer)}`);
  console.log(`Status: ${subscription.status}`);
  // TODO: Provision access, update DB, send welcome email
}

function handleSubscriptionUpdated(subscription: Stripe.Subscription): void {
  console.log(`Subscription updated: ${subscription.id}`);
  console.log(`New status: ${subscription.status}`);
  // TODO: Update access level, sync plan changes to DB
}

function handleSubscriptionDeleted(subscription: Stripe.Subscription): void {
  console.log(`Subscription cancelled: ${subscription.id}`);
  console.log(`Customer: ${String(subscription.customer)}`);
  // TODO: Revoke access, update DB, send cancellation confirmation
}

function handlePaymentSucceeded(invoice: Stripe.Invoice): void {
  console.log(`Payment succeeded for invoice: ${invoice.id ?? 'unknown'}`);
  console.log(`Amount: ${invoice.amount_paid} ${invoice.currency}`);
  console.log(`Customer: ${String(invoice.customer)}`);
  // TODO: Record payment in DB, generate internal invoice record
}

function handlePaymentFailed(invoice: Stripe.Invoice): void {
  console.log(`Payment failed for invoice: ${invoice.id ?? 'unknown'}`);
  console.log(`Customer: ${String(invoice.customer)}`);
  console.log(`Next retry: ${invoice.next_payment_attempt ?? 'none'}`);
  // TODO: Send payment failure alert, flag account for retry
}

function handleCheckoutCompleted(session: Stripe.Checkout.Session): void {
  console.log(`Checkout session completed: ${session.id}`);
  console.log(`Customer: ${String(session.customer)}`);
  console.log(`Payment status: ${session.payment_status}`);
  // TODO: Activate subscription, send onboarding email
}
