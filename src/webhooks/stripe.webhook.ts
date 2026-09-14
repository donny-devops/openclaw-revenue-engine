import { Request, Response } from 'express';
import Stripe from 'stripe';

import { requireEnv } from '../lib/env';
import {
  findPaymentByStripeSession,
  getPayment,
  markPaymentStatus,
  recordInvoicePayment,
  rememberStripeEvent,
  forgetStripeEvent,
} from '../billing/ledger';
import { redactSecrets } from '../security/redact';

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
 *
 * Fix for @typescript-eslint/require-await (line 36):
 * stripe.webhooks.constructEvent() is synchronous — it returns Stripe.Event
 * directly, not a Promise. No await expressions exist in this function.
 * Removed the async keyword; the return type changes from Promise<void> to void.
 *
 * Fix for @typescript-eslint/no-unnecessary-type-assertion (lines 65–80):
 * Stripe's SDK now ships precise generic types for event.data.object keyed by
 * event.type via the Stripe.DiscriminatedEvent union. In the switch branches,
 * TypeScript already narrows event to the correct discriminated type, so
 * casting event.data.object with `as Stripe.Subscription` etc. is redundant.
 * Replaced each cast with a typed const that reads from the pre-narrowed event.
 */
export function stripeWebhookHandler(
  req: Request,
  res: Response
): void {
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
    console.error(`Stripe webhook signature verification failed: ${redactSecrets(message)}`);
    res.status(400).json({ error: `Webhook signature verification failed: ${message}` });
    return;
  }

  if (!rememberStripeEvent(event.id)) {
    res.status(200).json({ received: true, eventType: event.type, duplicate: true });
    return;
  }

  console.log(`Stripe webhook received: ${event.type} [${event.id}]`);

  try {
    // Using Stripe.DiscriminatedEvent narrowing — no redundant type assertions needed.
    switch (event.type) {
      case 'customer.subscription.created':
        handleSubscriptionCreated(event.data.object);
        break;
      case 'customer.subscription.updated':
        handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        handleSubscriptionDeleted(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        handlePaymentSucceeded(event.data.object);
        break;
      case 'invoice.payment_failed':
        handlePaymentFailed(event.data.object);
        break;
      case 'checkout.session.completed':
        handleCheckoutCompleted(event.data.object);
        break;
      default:
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }
    res.status(200).json({ received: true, eventType: event.type });
  } catch (err) {
    forgetStripeEvent(event.id);
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
  if (invoice.id) {
    recordInvoicePayment({
      stripe_invoice_id: invoice.id,
      amount_cents: invoice.amount_paid,
      currency: invoice.currency,
      customer_id: String(invoice.customer),
      status: 'paid',
    });
  }
}

function handlePaymentFailed(invoice: Stripe.Invoice): void {
  console.log(`Payment failed for invoice: ${invoice.id ?? 'unknown'}`);
  console.log(`Customer: ${String(invoice.customer)}`);
  console.log(`Next retry: ${invoice.next_payment_attempt ?? 'none'}`);
  if (invoice.id) {
    recordInvoicePayment({
      stripe_invoice_id: invoice.id,
      amount_cents: invoice.amount_due ?? 0,
      currency: invoice.currency ?? 'usd',
      customer_id: String(invoice.customer),
      status: 'failed',
    });
  }
}

function handleCheckoutCompleted(session: Stripe.Checkout.Session): void {
  console.log(`Checkout session completed: ${session.id}`);
  console.log(`Customer: ${String(session.customer)}`);
  console.log(`Payment status: ${session.payment_status}`);
  const paymentId = session.metadata?.payment_id;
  const existing = (paymentId ? getPayment(paymentId) : undefined) ?? findPaymentByStripeSession(session.id);
  if (!existing) {
    return;
  }
  markPaymentStatus(existing.id, session.payment_status === 'paid' ? 'paid' : 'pending', {
    stripe_session_id: session.id,
    stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : undefined,
    amount_cents: session.amount_total ?? existing.amount_cents,
    currency: session.currency ?? existing.currency,
  });
}
