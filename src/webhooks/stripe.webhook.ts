import { Request, Response } from 'express';
import Stripe from 'stripe';

import {
  getRequiredEnv,
  isMissingRequiredEnvError,
  toErrorMessage,
} from '../config/env';
import {
  sendBadRequest,
  sendServiceMisconfigured,
  sendWebhookProcessingError,
} from '../utils/http';

let stripeClient: Stripe | null = null;

function getStripeClient(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(getRequiredEnv('STRIPE_SECRET_KEY'), {
      apiVersion: '2024-06-20',
    });
  }
  return stripeClient;
}

function buildStripeEvent(req: Request): Stripe.Event {
  const sig = req.headers['stripe-signature'];
  if (!sig) {
    throw new Error('Missing stripe-signature header');
  }

  return getStripeClient().webhooks.constructEvent(
    req.body as Buffer,
    sig,
    getRequiredEnv('STRIPE_WEBHOOK_SECRET')
  );
}

export function stripeWebhookHandler(req: Request, res: Response): void {
  let event: Stripe.Event;

  try {
    event = buildStripeEvent(req);
  } catch (err) {
    const message = toErrorMessage(err);
    console.error(`Stripe webhook setup/signature failure: ${message}`);

    if (isMissingRequiredEnvError(err)) {
      sendServiceMisconfigured(res, 'Stripe');
      return;
    }

    sendBadRequest(res, `Webhook signature verification failed: ${message}`);
    return;
  }

  console.log(`Stripe webhook received: ${event.type} [${event.id}]`);

  try {
    handleStripeEvent(event);
    res.status(200).json({ received: true, eventType: event.type });
  } catch (err) {
    console.error(`Error processing Stripe webhook ${event.type}: ${toErrorMessage(err)}`);
    sendWebhookProcessingError(res);
  }
}

function handleStripeEvent(event: Stripe.Event): void {
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
