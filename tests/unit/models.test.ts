/**
 * tests/unit/models.test.ts
 *
 * Unit tests for the pure TypeScript domain models in src/models/index.ts.
 * All enums, interfaces, and factory helpers are tested for valid values,
 * discriminated type narrowing, and completeness.
 */

import {
  BillingPlan,
  InvoiceStatus,
  SubscriptionStatus,
  UsageMetricType,
  type EarningsSummary,
} from '../../src/models';
import {
  makeTenant,
  makeInvoice,
  makeSubscription,
  makeUsageRecord,
} from '../helpers/fixtures';

// ---------------------------------------------------------------------------
// Enums existence and value checks
// ---------------------------------------------------------------------------

describe('BillingPlan enum', () => {
  it('defines all four tiers', () => {
    expect(BillingPlan.Free).toBe('free');
    expect(BillingPlan.Starter).toBe('starter');
    expect(BillingPlan.Pro).toBe('pro');
    expect(BillingPlan.Enterprise).toBe('enterprise');
  });
});

describe('InvoiceStatus enum', () => {
  it('defines all valid invoice states', () => {
    expect(InvoiceStatus.Draft).toBe('draft');
    expect(InvoiceStatus.Pending).toBe('pending');
    expect(InvoiceStatus.Paid).toBe('paid');
    expect(InvoiceStatus.Overdue).toBe('overdue');
    expect(InvoiceStatus.Void).toBe('void');
  });
});

describe('SubscriptionStatus enum', () => {
  it('defines all valid subscription states', () => {
    expect(SubscriptionStatus.Active).toBe('active');
    expect(SubscriptionStatus.Trialing).toBe('trialing');
    expect(SubscriptionStatus.PastDue).toBe('past_due');
    expect(SubscriptionStatus.Canceled).toBe('canceled');
    expect(SubscriptionStatus.Incomplete).toBe('incomplete');
  });
});

describe('UsageMetricType enum', () => {
  it('defines all supported metric types', () => {
    expect(UsageMetricType.ApiCall).toBe('api_call');
    expect(UsageMetricType.TokensUsed).toBe('tokens_used');
    expect(UsageMetricType.DataProcessed).toBe('data_processed_bytes');
    expect(UsageMetricType.AgentRun).toBe('agent_run');
  });
});

// ---------------------------------------------------------------------------
// Interface shape validation via factory helpers
// ---------------------------------------------------------------------------

describe('Tenant interface — makeTenant factory', () => {
  it('creates a valid default Tenant', () => {
    const tenant = makeTenant();

    expect(tenant).toMatchObject({
      id: expect.any(String) as unknown,
      name: expect.any(String) as unknown,
      email: expect.any(String) as unknown,
      billingPlan: BillingPlan.Pro,
      stripeCustomerId: expect.any(String) as unknown,
      createdAt: expect.any(Date) as unknown,
      updatedAt: expect.any(Date) as unknown,
    });
  });

  it('allows overrides for all fields', () => {
    const tenant = makeTenant({
      id: 'custom_tenant_id',
      name: 'CustomCorp',
      billingPlan: BillingPlan.Enterprise,
    });

    expect(tenant.id).toBe('custom_tenant_id');
    expect(tenant.name).toBe('CustomCorp');
    expect(tenant.billingPlan).toBe(BillingPlan.Enterprise);
  });

  it('accepts null stripeCustomerId', () => {
    const tenant = makeTenant({ stripeCustomerId: null });
    expect(tenant.stripeCustomerId).toBeNull();
  });
});

describe('Invoice interface — makeInvoice factory', () => {
  it('creates a valid default Invoice', () => {
    const invoice = makeInvoice();

    expect(invoice).toMatchObject({
      id: expect.any(String) as unknown,
      tenantId: expect.any(String) as unknown,
      stripeInvoiceId: expect.any(String) as unknown,
      status: InvoiceStatus.Paid,
      amountDue: expect.any(Number) as unknown,
      amountPaid: expect.any(Number) as unknown,
      currency: expect.any(String) as unknown,
      periodStart: expect.any(Date) as unknown,
      periodEnd: expect.any(Date) as unknown,
      lineItems: expect.any(Array) as unknown,
      pdfUrl: null,
      createdAt: expect.any(Date) as unknown,
      updatedAt: expect.any(Date) as unknown,
    });
  });

  it('allows overrides for status and amounts', () => {
    const invoice = makeInvoice({
      status: InvoiceStatus.Overdue,
      amountDue: 10000,
      amountPaid: 5000,
    });

    expect(invoice.status).toBe(InvoiceStatus.Overdue);
    expect(invoice.amountDue).toBe(10000);
    expect(invoice.amountPaid).toBe(5000);
  });
});

describe('Subscription interface — makeSubscription factory', () => {
  it('creates a valid default Subscription', () => {
    const sub = makeSubscription();

    expect(sub).toMatchObject({
      id: expect.any(String) as unknown,
      tenantId: expect.any(String) as unknown,
      stripeSubscriptionId: expect.any(String) as unknown,
      plan: BillingPlan.Pro,
      status: SubscriptionStatus.Active,
      currentPeriodStart: expect.any(Date) as unknown,
      currentPeriodEnd: expect.any(Date) as unknown,
      cancelAtPeriodEnd: false,
      createdAt: expect.any(Date) as unknown,
      updatedAt: expect.any(Date) as unknown,
    });
  });

  it('allows overrides for status and plan', () => {
    const sub = makeSubscription({
      status: SubscriptionStatus.Canceled,
      plan: BillingPlan.Free,
      cancelAtPeriodEnd: true,
    });

    expect(sub.status).toBe(SubscriptionStatus.Canceled);
    expect(sub.plan).toBe(BillingPlan.Free);
    expect(sub.cancelAtPeriodEnd).toBe(true);
  });
});

describe('UsageRecord interface — makeUsageRecord factory', () => {
  it('creates a valid default UsageRecord', () => {
    const usage = makeUsageRecord();

    expect(usage).toMatchObject({
      id: expect.any(String) as unknown,
      tenantId: expect.any(String) as unknown,
      metricType: UsageMetricType.ApiCall,
      quantity: expect.any(Number) as unknown,
      unit: expect.any(String) as unknown,
      recordedAt: expect.any(Date) as unknown,
      metadata: expect.any(Object) as unknown,
    });
  });

  it('allows overrides for metricType and quantity', () => {
    const usage = makeUsageRecord({
      metricType: UsageMetricType.TokensUsed,
      quantity: 1024,
      unit: 'tokens',
    });

    expect(usage.metricType).toBe(UsageMetricType.TokensUsed);
    expect(usage.quantity).toBe(1024);
    expect(usage.unit).toBe('tokens');
  });
});

// ---------------------------------------------------------------------------
// EarningsSummary interface shape (no factory, so inline construction)
// ---------------------------------------------------------------------------

describe('EarningsSummary interface', () => {
  it('can be manually constructed with all required fields', () => {
    const summary: EarningsSummary = {
      tenantId: 'tenant_summary',
      periodStart: new Date('2025-01-01'),
      periodEnd: new Date('2025-01-31'),
      totalRevenue: 100000,
      totalInvoices: 10,
      paidInvoices: 8,
      overdueInvoices: 2,
      topMetricType: UsageMetricType.ApiCall,
    };

    expect(summary.tenantId).toBe('tenant_summary');
    expect(summary.totalRevenue).toBe(100000);
    expect(summary.topMetricType).toBe(UsageMetricType.ApiCall);
  });

  it('allows null topMetricType', () => {
    const summary: EarningsSummary = {
      tenantId: 'tenant_empty',
      periodStart: new Date('2025-01-01'),
      periodEnd: new Date('2025-01-31'),
      totalRevenue: 0,
      totalInvoices: 0,
      paidInvoices: 0,
      overdueInvoices: 0,
      topMetricType: null,
    };

    expect(summary.topMetricType).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Discriminated type narrowing (TypeScript compile-time check)
// ---------------------------------------------------------------------------

describe('TypeScript discriminated unions', () => {
  it('allows type narrowing by enum value (compile-time only)', () => {
    const plan: BillingPlan = BillingPlan.Enterprise;

    // If TypeScript compiler fails to narrow, tests won't compile
    if (plan === BillingPlan.Enterprise) {
      expect(plan).toBe('enterprise');
    }
  });
});
