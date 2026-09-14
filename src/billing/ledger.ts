import { newId } from '../lib/ids';
import { EarningsSnapshot, PaymentRecord, PaymentStatus } from './types';

const payments = new Map<string, PaymentRecord>();
const processedStripeEvents = new Set<string>();

const nowIso = (): string => new Date().toISOString();

const clone = (record: PaymentRecord): PaymentRecord => ({
  ...record,
  metadata: { ...record.metadata },
});

export function resetLedger(): void {
  payments.clear();
  processedStripeEvents.clear();
}

export function rememberStripeEvent(eventId: string): boolean {
  if (!eventId) return true;
  if (processedStripeEvents.has(eventId)) return false;
  processedStripeEvents.add(eventId);
  return true;
}

export function forgetStripeEvent(eventId: string): void {
  if (!eventId) return;
  processedStripeEvents.delete(eventId);
}

export function createPayment(input: {
  lane: string;
  service: string;
  amount_cents: number;
  currency: string;
  customer_email?: string;
  checkout_url?: string;
  stripe_session_id?: string;
  simulated: boolean;
  metadata?: Record<string, string>;
}): PaymentRecord {
  const timestamp = nowIso();
  const record: PaymentRecord = {
    id: newId('pay'),
    status: 'pending',
    lane: input.lane,
    service: input.service,
    amount_cents: input.amount_cents,
    currency: input.currency.toLowerCase(),
    customer_email: input.customer_email,
    checkout_url: input.checkout_url,
    stripe_session_id: input.stripe_session_id,
    simulated: input.simulated,
    created_at: timestamp,
    updated_at: timestamp,
    metadata: input.metadata ?? {},
  };
  payments.set(record.id, record);
  return clone(record);
}

export function getPayment(id: string): PaymentRecord | undefined {
  const record = payments.get(id);
  return record ? clone(record) : undefined;
}

export function listPayments(): PaymentRecord[] {
  return Array.from(payments.values())
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map(clone);
}

export function updatePayment(id: string, patch: Partial<PaymentRecord>): PaymentRecord {
  const existing = payments.get(id);
  if (!existing) {
    throw new Error(`Unknown payment: ${id}`);
  }
  const updated: PaymentRecord = {
    ...existing,
    ...patch,
    id: existing.id,
    metadata: patch.metadata ? { ...existing.metadata, ...patch.metadata } : existing.metadata,
    updated_at: nowIso(),
  };
  payments.set(id, updated);
  return clone(updated);
}

export function markPaymentStatus(id: string, status: PaymentStatus, extra: Partial<PaymentRecord> = {}): PaymentRecord {
  return updatePayment(id, { ...extra, status });
}

export function findPaymentByStripeSession(sessionId: string): PaymentRecord | undefined {
  const found = Array.from(payments.values()).find((item) => item.stripe_session_id === sessionId);
  return found ? clone(found) : undefined;
}

export function findPaymentByStripeInvoice(invoiceId: string): PaymentRecord | undefined {
  const found = Array.from(payments.values()).find((item) => item.stripe_invoice_id === invoiceId);
  return found ? clone(found) : undefined;
}

export function recordInvoicePayment(input: {
  stripe_invoice_id: string;
  amount_cents: number;
  currency: string;
  customer_id?: string;
  status: PaymentStatus;
}): PaymentRecord {
  const existing = findPaymentByStripeInvoice(input.stripe_invoice_id);
  if (existing) {
    return markPaymentStatus(existing.id, input.status, {
      amount_cents: input.amount_cents,
      currency: input.currency.toLowerCase(),
    });
  }

  const timestamp = nowIso();
  const record: PaymentRecord = {
    id: newId('pay'),
    status: input.status,
    lane: 'subscription',
    service: 'stripe-invoice',
    amount_cents: input.amount_cents,
    currency: input.currency.toLowerCase(),
    stripe_invoice_id: input.stripe_invoice_id,
    simulated: false,
    created_at: timestamp,
    updated_at: timestamp,
    metadata: input.customer_id ? { customer_id: input.customer_id } : {},
  };
  payments.set(record.id, record);
  return clone(record);
}

export function getEarningsSnapshot(currency = 'usd'): EarningsSnapshot {
  const records = listPayments();
  const pending = records.filter((item) => item.status === 'pending');
  const collected = records.filter((item) => item.status === 'paid');
  const failed = records.filter((item) => item.status === 'failed' || item.status === 'canceled');
  const collectedCents = collected.reduce((sum, item) => sum + item.amount_cents, 0);

  return {
    currency,
    pending_cents: pending.reduce((sum, item) => sum + item.amount_cents, 0),
    collected_cents: collectedCents,
    failed_cents: failed.reduce((sum, item) => sum + item.amount_cents, 0),
    pending_count: pending.length,
    collected_count: collected.length,
    failed_count: failed.length,
    collected_usd: collectedCents / 100,
    payments: records.length,
  };
}
