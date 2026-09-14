import Stripe from 'stripe';

import { requireEnv } from '../lib/env';

let stripe: Stripe | undefined;

export function getStripe(): Stripe {
  if (!stripe) {
    stripe = new Stripe(requireEnv('STRIPE_SECRET_KEY'), {
      apiVersion: '2024-06-20',
    });
  }
  return stripe;
}

export function resetStripeClient(): void {
  stripe = undefined;
}

export function isSimulatedStripe(): boolean {
  if (process.env.STRIPE_MODE === 'live') {
    return false;
  }
  const key = process.env.STRIPE_SECRET_KEY ?? '';
  return (
    process.env.STRIPE_MODE === 'simulated' ||
    process.env.NODE_ENV === 'test' ||
    /placeholder|your_stripe|fixture_key|bare_env/i.test(key)
  );
}
