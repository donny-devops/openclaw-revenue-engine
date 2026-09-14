export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'canceled';

export interface PaymentRecord {
  id: string;
  status: PaymentStatus;
  lane: string;
  service: string;
  amount_cents: number;
  currency: string;
  customer_email?: string;
  stripe_session_id?: string;
  stripe_payment_intent_id?: string;
  stripe_invoice_id?: string;
  checkout_url?: string;
  simulated: boolean;
  created_at: string;
  updated_at: string;
  metadata: Record<string, string>;
}

export interface EarningsSnapshot {
  currency: string;
  pending_cents: number;
  collected_cents: number;
  failed_cents: number;
  pending_count: number;
  collected_count: number;
  failed_count: number;
  collected_usd: number;
  payments: number;
}

export interface UsageEvent {
  id: string;
  tenant_id: string;
  metric_type: string;
  quantity: number;
  unit: string;
  idempotency_key?: string;
  recorded_at: string;
  metadata: Record<string, unknown>;
}

export interface UsageSummary {
  tenant_id?: string;
  events: number;
  totals_by_metric: Record<string, number>;
}
