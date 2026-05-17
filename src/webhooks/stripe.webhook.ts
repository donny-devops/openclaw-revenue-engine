import { Request, Response } from 'express';
import Stripe from 'stripe';

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return val;
}

let stripeClient: Stripe | null = null;

function getStripeClient(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(requireEnv('STRIPE_SECRET_KEY'), {
      apiVersion: '2024-06-20',
    });
  }
  return stripeClient;
}

/**
 * Stripe Webhook Handler
 *
 * Verifies the Stripe signature, then routes each event type to its appropriate
 * handler. Uses raw body for HMAC verification.
 *
 * IMPORTANT: Register this handler with express.raw({ type: 'application/json' })
 * before global express.json() middleware.
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
    event = getStripeClient().webhooks.constructEvent(
      req.body as Buffer,
      sig,
      requireEnv('STRIPE_WEBHOOK_SECRET')
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const isConfigError = message.startsWith('Missing required environment variable:');

    console.error(`Stripe webhook setup/signature failure: ${message}`);
    res.status(isConfigError ? 500 : 400).json({
      error: isConfigError ? 'Stripe webhook is not configured' : `Webhook signature verification failed: ${message}`,
    });
    return;
  }

  console.log(`Stripe webhook received: ${event.type} [${event.id}]`);

  try {
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
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Error processing Stripe webhook ${event.type}: ${message}`);
    res.status(500).json({ error: 'Internal webhook processing error' });
  }
}

function handleSubscriptionCreated(subscription: Stripe.Subscription): void {
  console.log(`New subscription created: ${subscription.id}`);
  console.log(`Customer: ${String(subscription.customer)}`);
  console.log(`Status: ${subscription.status}`);
}

function handleSubscriptionUpdated(subscription: Stripe.Subscription): void {
  console.log(`Subscription updated: ${subscription.id}`);
  console.log(`New status: ${subscription.status}`);
}

function handleSubscriptionDeleted(subscription: Stripe.Subscription): void {
  console.log(`Subscription cancelled: ${subscription.id}`);
  console.log(`Customer: ${String(subscription.customer)}`);
}

function handlePaymentSucceeded(invoice: Stripe.Invoice): void {
  console.log(`Payment succeeded for invoice: ${invoice.id ?? 'unknown'}`);
  console.log(`Amount: ${invoice.amount_paid} ${invoice.currency}`);
  console.log(`Customer: ${String(invoice.customer)}`);
}

function handlePaymentFailed(invoice: Stripe.Invoice): void {
  console.log(`Payment failed for invoice: ${invoice.id ?? 'unknown'}`);
  console.log(`Customer: ${String(invoice.customer)}`);
  console.log(`Next retry: ${invoice.next_payment_attempt ?? 'none'}`);
}

function handleCheckoutCompleted(session: Stripe.Checkout.Session): void {
  console.log(`Checkout session completed: ${session.id}`);
  console.log(`Customer: ${String(session.customer)}`);
  console.log(`Payment status: ${session.payment_status}`);
}
