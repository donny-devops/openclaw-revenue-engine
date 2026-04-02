/**
 * src/models/index.ts
 * Domain models for the OpenClaw Revenue Engine.
 * All types are pure TypeScript — framework-agnostic and safe to import anywhere.
 */

// ─── Enums ─────────────────────────────────────────────────────────────────────
export const enum BillingPlan {
  Free = 'free',
  Starter = 'starter',
  Pro = 'pro',
  Enterprise = 'enterprise',
}

export const enum InvoiceStatus {
  Draft = 'draft',
  Pending = 'pending',
  Paid = 'paid',
  Overdue = 'overdue',
  Void = 'void',
}

export const enum UsageMetricType {
  ApiCall = 'api_call',
  TokensUsed = 'tokens_used',
  DataProcessed = 'data_processed_bytes',
  AgentRun = 'agent_run',
}

export const enum SubscriptionStatus {
  Active = 'active',
  Trialing = 'trialing',
  PastDue = 'past_due',
  Canceled = 'canceled',
  Incomplete = 'incomplete',
}

// ─── Core Domain Models ───────────────────────────────────────────────────────────

export interface Tenant {
  id: string;
  name: string;
  email: string;
  billingPlan: BillingPlan;
  stripeCustomerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UsageRecord {
  id: string;
  tenantId: string;
  metricType: UsageMetricType;
  quantity: number;
  unit: string;
  recordedAt: Date;
  metadata: Record<string, unknown>;
}

export interface Invoice {
  id: string;
  tenantId: string;
  stripeInvoiceId: string | null;
  status: InvoiceStatus;
  amountDue: number;     // in cents
  amountPaid: number;    // in cents
  currency: string;      // ISO 4217, e.g. 'usd'
  periodStart: Date;
  periodEnd: Date;
  lineItems: InvoiceLineItem[];
  pdfUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitAmount: number;   // in cents
  totalAmount: number;  // in cents
  metricType: UsageMetricType | null;
}

export interface Subscription {
  id: string;
  tenantId: string;
  stripeSubscriptionId: string;
  plan: BillingPlan;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EarningsSummary {
  tenantId: string;
  periodStart: Date;
  periodEnd: Date;
  totalRevenue: number;    // in cents
  totalInvoices: number;
  paidInvoices: number;
  overdueInvoices: number;
  topMetricType: UsageMetricType | null;
}

// ─── API Request / Response Shapes ────────────────────────────────────────────────

export interface CreateTenantRequest {
  name: string;
  email: string;
  billingPlan?: BillingPlan;
}

export interface RecordUsageRequest {
  tenantId: string;
  metricType: UsageMetricType;
  quantity: number;
  unit?: string;
  metadata?: Record<string, unknown>;
}

export interface GenerateInvoiceRequest {
  tenantId: string;
  periodStart: Date;
  periodEnd: Date;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    total?: number;
    page?: number;
    perPage?: number;
  };
}

// ─── Stripe Webhook Payload Types ─────────────────────────────────────────────────

export interface StripeWebhookEvent {
  id: string;
  type: string;
  livemode: boolean;
  created: number;
  data: {
    object: Record<string, unknown>;
  };
}

export interface StripeInvoicePayload {
  id: string;
  customer: string;
  status: string;
  amount_due: number;
  amount_paid: number;
  currency: string;
  period_start: number;
  period_end: number;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
}

export interface StripeSubscriptionPayload {
  id: string;
  customer: string;
  status: string;
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  items: {
    data: Array<{
      id: string;
      price: { id: string; nickname: string | null };
    }>;
  };
}
