import Stripe from 'stripe';

import { requireEnv } from '../lib/env';

const rawKey = process.env.STRIPE_SECRET_KEY?.trim() || '';
const isProd = process.env.NODE_ENV === 'production';

// Test or placeholder indicators
const isPlaceholderKey =
  !rawKey ||
  /placeholder|your_stripe|fixture_key|bare_env/i.test(rawKey) ||
  rawKey.startsWith('sk_test_ci') ||
  rawKey === 'sk_test_placeholder';

const isLiveKey = rawKey.startsWith('sk_live_') || rawKey.startsWith('rk_live_');

// Strict production gate: Fail closed at module initialization
if (isProd && !isLiveKey) {
  throw new Error(
    `[FATAL] STRIPE_SECRET_KEY must be a valid live Stripe key (sk_live_* / rk_live_*) in production. ` +
      `Simulated checkout fallback is strictly forbidden in production.`
  );
}

let stripe: Stripe | undefined;

export function getStripe(): Stripe {
  if (process.env.NODE_ENV === 'production') {
    const currentKey = process.env.STRIPE_SECRET_KEY?.trim() || '';
    if (!currentKey.startsWith('sk_live_') && !currentKey.startsWith('rk_live_')) {
      throw new Error(
        `[FATAL] STRIPE_SECRET_KEY must be a valid live Stripe key (sk_live_* / rk_live_*) in production. ` +
          `Simulated checkout fallback is strictly forbidden in production.`
      );
    }
  }
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
  const currentKey = process.env.STRIPE_SECRET_KEY?.trim() ?? '';
  if (process.env.NODE_ENV === 'production') {
    if (!currentKey.startsWith('sk_live_') && !currentKey.startsWith('rk_live_')) {
      throw new Error(
        `[FATAL] STRIPE_SECRET_KEY must be a valid live Stripe key (sk_live_* / rk_live_*) in production. ` +
          `Simulated checkout fallback is strictly forbidden in production.`
      );
    }
    return false;
  }
  if (process.env.STRIPE_MODE === 'live') {
    return false;
  }
  return (
    process.env.STRIPE_MODE === 'simulated' ||
    process.env.NODE_ENV === 'test' ||
    !currentKey ||
    isPlaceholderKey ||
    /placeholder|your_stripe|fixture_key|bare_env/i.test(currentKey) ||
    currentKey.startsWith('sk_test_ci')
  );
}

export const stripeClient: Stripe | null = isSimulatedStripe()
  ? null
  : new Stripe(rawKey, {
      apiVersion: '2024-06-20',
      typescript: true,
    });
