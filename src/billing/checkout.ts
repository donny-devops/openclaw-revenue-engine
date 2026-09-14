import { classifyPaidRequest } from '../revenue/serviceCatalog';
import { ClassifiedPaidRequest, PaidRequestInput } from '../revenue/types';
import { optionalEnv } from '../lib/env';
import { createPayment, getPayment, markPaymentStatus } from './ledger';
import { PaymentRecord } from './types';
import { getStripe, isSimulatedStripe } from './stripeClient';

export interface CheckoutRequest extends PaidRequestInput {
  customer_email: string;
  success_url?: string;
  cancel_url?: string;
}

export interface CheckoutResult {
  payment: PaymentRecord;
  classification: ClassifiedPaidRequest;
  checkout_url: string;
  simulated: boolean;
}

const defaultSuccessUrl = (): string =>
  optionalEnv('STRIPE_SUCCESS_URL', 'http://localhost:3000/revenue/payments/{CHECKOUT_SESSION_ID}');

const defaultCancelUrl = (): string =>
  optionalEnv('STRIPE_CANCEL_URL', 'http://localhost:3000/revenue/checkout/canceled');

export async function createLaneCheckout(input: CheckoutRequest): Promise<CheckoutResult> {
  if (!input.customer_email?.trim()) {
    throw new Error('customer_email is required');
  }

  const classification = classifyPaidRequest(input);
  const agentPlan = classification.agent_plan;
  const assignedAgent = classification.assigned_agent;
  if (!agentPlan || !assignedAgent) {
    throw new Error('Revenue classification did not assign an agent');
  }
  const simulated = isSimulatedStripe();
  const amountCents = Math.round(classification.estimated_revenue * 100);
  const currency = classification.currency.toLowerCase();

  const payment = createPayment({
    lane: classification.lane.slug,
    service: classification.service.slug,
    amount_cents: amountCents,
    currency,
    customer_email: input.customer_email,
    simulated,
    metadata: {
      agent: assignedAgent.slug,
      source: input.source ?? 'api',
    },
  });

  if (simulated) {
    const checkoutUrl = `${optionalEnv('PUBLIC_BASE_URL', 'http://localhost:3000')}/revenue/payments/${payment.id}`;
    const updated = markPaymentStatus(payment.id, 'pending', {
      checkout_url: checkoutUrl,
      stripe_session_id: `cs_sim_${payment.id}`,
    });
    return {
      payment: updated,
      classification,
      checkout_url: checkoutUrl,
      simulated: true,
    };
  }

  const stripe = getStripe();
  const successUrl = input.success_url ?? defaultSuccessUrl();
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: input.customer_email,
    success_url: successUrl.includes('{CHECKOUT_SESSION_ID}')
      ? successUrl
      : `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: input.cancel_url ?? defaultCancelUrl(),
    client_reference_id: payment.id,
    metadata: {
      payment_id: payment.id,
      lane: classification.lane.slug,
      service: classification.service.slug,
      agent: assignedAgent.slug,
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency,
          unit_amount: amountCents,
          product_data: {
            name: `${classification.service.name} (${classification.lane.name})`,
            description: classification.input_summary,
          },
        },
      },
    ],
  });

  if (!session.url) {
    throw new Error('Stripe did not return a checkout URL');
  }

  const updated = markPaymentStatus(payment.id, 'pending', {
    checkout_url: session.url,
    stripe_session_id: session.id,
  });

  return {
    payment: updated,
    classification,
    checkout_url: session.url,
    simulated: false,
  };
}

export function simulatePaymentCollection(paymentId: string): PaymentRecord {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Simulated collection is disabled in production');
  }
  const payment = getPayment(paymentId);
  if (!payment) {
    throw new Error(`Unknown payment: ${paymentId}`);
  }
  if (!payment.simulated) {
    throw new Error('Only simulated payments can be completed locally');
  }
  return markPaymentStatus(paymentId, 'paid');
}
