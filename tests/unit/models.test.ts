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
  type InvoiceLineItem,
  type CreateTenantRequest,
  type RecordUsageRequest,
  type GenerateInvoiceRequest,
  type ApiResponse,
  type StripeWebhookEvent,
  type StripeInvoicePayload,
  type StripeSubscriptionPayload,
} from '../../src/models';
import {
  makeTenant,
  makeInvoice,
  makeSubscription,
  makeUsageRecord,
  makeInvoiceLineItem,
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
      id: expect.any(String),
      name: expect.any(String),
      email: expect.any(String),
      billingPlan: BillingPlan.Pro,
      stripeCustomerId: expect.any(String),
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
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
      id: expect.any(String),
      tenantId: expect.any(String),
      stripeInvoiceId: expect.any(String),
      status: InvoiceStatus.Paid,
      amountDue: expect.any(Number),
      amountPaid: expect.any(Number),
      currency: expect.any(String),
      periodStart: expect.any(Date),
      periodEnd: expect.any(Date),
      lineItems: expect.any(Array),
      pdfUrl: null,
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
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
      id: expect.any(String),
      tenantId: expect.any(String),
      stripeSubscriptionId: expect.any(String),
      plan: BillingPlan.Pro,
      status: SubscriptionStatus.Active,
      currentPeriodStart: expect.any(Date),
      currentPeriodEnd: expect.any(Date),
      cancelAtPeriodEnd: false,
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
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
      id: expect.any(String),
      tenantId: expect.any(String),
      metricType: UsageMetricType.ApiCall,
      quantity: expect.any(Number),
      unit: expect.any(String),
      recordedAt: expect.any(Date),
      metadata: expect.any(Object),
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

// ---------------------------------------------------------------------------
// InvoiceLineItem interface — makeInvoiceLineItem factory
// ---------------------------------------------------------------------------

describe('InvoiceLineItem interface — makeInvoiceLineItem factory', () => {
  it('creates a valid default InvoiceLineItem', () => {
    const item = makeInvoiceLineItem();

    expect(item).toMatchObject({
      id: expect.any(String),
      invoiceId: expect.any(String),
      description: expect.any(String),
      quantity: expect.any(Number),
      unitAmount: expect.any(Number),
      totalAmount: expect.any(Number),
      metricType: UsageMetricType.ApiCall,
    });
  });

  it('allows null metricType for flat-fee line items', () => {
    const item = makeInvoiceLineItem({ metricType: null });

    expect(item.metricType).toBeNull();
  });

  it('allows overrides for description and amounts', () => {
    const item = makeInvoiceLineItem({
      id: 'line_custom',
      description: 'Enterprise base fee',
      quantity: 1,
      unitAmount: 100000,
      totalAmount: 100000,
    });

    expect(item.id).toBe('line_custom');
    expect(item.description).toBe('Enterprise base fee');
    expect(item.unitAmount).toBe(100000);
    expect(item.totalAmount).toBe(100000);
  });

  it('is embeddable in an Invoice lineItems array', () => {
    const invoice = makeInvoice({
      lineItems: [
        makeInvoiceLineItem({ id: 'line_a', description: 'API calls', quantity: 500 }),
        makeInvoiceLineItem({ id: 'line_b', description: 'Tokens', metricType: UsageMetricType.TokensUsed }),
      ],
    });

    expect(invoice.lineItems).toHaveLength(2);
    expect(invoice.lineItems[0]?.id).toBe('line_a');
    expect(invoice.lineItems[1]?.metricType).toBe(UsageMetricType.TokensUsed);
  });
});

// ---------------------------------------------------------------------------
// API request / response interface shapes
// ---------------------------------------------------------------------------

describe('CreateTenantRequest interface', () => {
  it('can be constructed with required fields only', () => {
    const req: CreateTenantRequest = {
      name: 'Acme Inc',
      email: 'billing@acme.com',
    };

    expect(req.name).toBe('Acme Inc');
    expect(req.email).toBe('billing@acme.com');
    expect(req.billingPlan).toBeUndefined();
  });

  it('accepts an optional billingPlan', () => {
    const req: CreateTenantRequest = {
      name: 'BigCorp',
      email: 'pay@bigcorp.com',
      billingPlan: BillingPlan.Enterprise,
    };

    expect(req.billingPlan).toBe(BillingPlan.Enterprise);
  });
});

describe('RecordUsageRequest interface', () => {
  it('can be constructed with required fields only', () => {
    const req: RecordUsageRequest = {
      tenantId: 'tenant_01',
      metricType: UsageMetricType.ApiCall,
      quantity: 500,
    };

    expect(req.tenantId).toBe('tenant_01');
    expect(req.metricType).toBe(UsageMetricType.ApiCall);
    expect(req.quantity).toBe(500);
    expect(req.unit).toBeUndefined();
    expect(req.metadata).toBeUndefined();
  });

  it('accepts optional unit and metadata', () => {
    const req: RecordUsageRequest = {
      tenantId: 'tenant_02',
      metricType: UsageMetricType.DataProcessed,
      quantity: 1024,
      unit: 'bytes',
      metadata: { source: 'pipeline-a', region: 'us-east-1' },
    };

    expect(req.unit).toBe('bytes');
    expect(req.metadata).toEqual({ source: 'pipeline-a', region: 'us-east-1' });
  });
});

describe('GenerateInvoiceRequest interface', () => {
  it('can be constructed with all required fields', () => {
    const req: GenerateInvoiceRequest = {
      tenantId: 'tenant_01',
      periodStart: new Date('2025-01-01'),
      periodEnd: new Date('2025-01-31'),
    };

    expect(req.tenantId).toBe('tenant_01');
    expect(req.periodStart).toBeInstanceOf(Date);
    expect(req.periodEnd).toBeInstanceOf(Date);
    expect(req.periodEnd.getTime()).toBeGreaterThan(req.periodStart.getTime());
  });
});

describe('ApiResponse<T> generic interface', () => {
  it('represents a successful response with data', () => {
    const response: ApiResponse<{ id: string }> = {
      success: true,
      data: { id: 'tenant_01' },
    };

    expect(response.success).toBe(true);
    expect(response.data).toEqual({ id: 'tenant_01' });
    expect(response.error).toBeUndefined();
  });

  it('represents an error response without data', () => {
    const response: ApiResponse = {
      success: false,
      error: 'Tenant not found',
    };

    expect(response.success).toBe(false);
    expect(response.error).toBe('Tenant not found');
    expect(response.data).toBeUndefined();
  });

  it('includes pagination metadata when provided', () => {
    const response: ApiResponse<string[]> = {
      success: true,
      data: ['a', 'b', 'c'],
      meta: { total: 100, page: 2, perPage: 3 },
    };

    expect(response.meta?.total).toBe(100);
    expect(response.meta?.page).toBe(2);
    expect(response.meta?.perPage).toBe(3);
  });

  it('allows partial meta fields', () => {
    const response: ApiResponse<null> = {
      success: true,
      data: null,
      meta: { total: 0 },
    };

    expect(response.meta?.total).toBe(0);
    expect(response.meta?.page).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Stripe webhook payload types
// ---------------------------------------------------------------------------

describe('StripeWebhookEvent interface', () => {
  it('can be constructed with all required fields', () => {
    const event: StripeWebhookEvent = {
      id: 'evt_test_001',
      type: 'customer.subscription.created',
      livemode: false,
      created: 1700000000,
      data: {
        object: { id: 'sub_test', customer: 'cus_test', status: 'active' },
      },
    };

    expect(event.id).toBe('evt_test_001');
    expect(event.type).toBe('customer.subscription.created');
    expect(event.livemode).toBe(false);
    expect(event.data.object).toHaveProperty('id', 'sub_test');
  });

  it('distinguishes livemode true / false', () => {
    const live: StripeWebhookEvent = {
      id: 'evt_live_01',
      type: 'invoice.payment_succeeded',
      livemode: true,
      created: 1700000001,
      data: { object: {} },
    };

    expect(live.livemode).toBe(true);
  });
});

describe('StripeInvoicePayload interface', () => {
  it('can be constructed with all required fields', () => {
    const payload: StripeInvoicePayload = {
      id: 'in_test_001',
      customer: 'cus_test_001',
      status: 'paid',
      amount_due: 5000,
      amount_paid: 5000,
      currency: 'usd',
      period_start: 1700000000,
      period_end: 1702678400,
      hosted_invoice_url: 'https://invoice.stripe.com/test',
      invoice_pdf: 'https://invoice.stripe.com/test.pdf',
    };

    expect(payload.id).toBe('in_test_001');
    expect(payload.amount_paid).toBe(5000);
    expect(payload.currency).toBe('usd');
  });

  it('allows null hosted_invoice_url and invoice_pdf', () => {
    const payload: StripeInvoicePayload = {
      id: 'in_test_002',
      customer: 'cus_test_001',
      status: 'draft',
      amount_due: 0,
      amount_paid: 0,
      currency: 'usd',
      period_start: 1700000000,
      period_end: 1702678400,
      hosted_invoice_url: null,
      invoice_pdf: null,
    };

    expect(payload.hosted_invoice_url).toBeNull();
    expect(payload.invoice_pdf).toBeNull();
  });
});

describe('StripeSubscriptionPayload interface', () => {
  it('can be constructed with all required fields', () => {
    const payload: StripeSubscriptionPayload = {
      id: 'sub_test_001',
      customer: 'cus_test_001',
      status: 'active',
      current_period_start: 1700000000,
      current_period_end: 1702678400,
      cancel_at_period_end: false,
      items: {
        data: [
          {
            id: 'si_test_001',
            price: { id: 'price_pro_monthly', nickname: 'Pro Monthly' },
          },
        ],
      },
    };

    expect(payload.id).toBe('sub_test_001');
    expect(payload.status).toBe('active');
    expect(payload.cancel_at_period_end).toBe(false);
    expect(payload.items.data).toHaveLength(1);
    expect(payload.items.data[0]?.price.id).toBe('price_pro_monthly');
  });

  it('handles null price nickname', () => {
    const payload: StripeSubscriptionPayload = {
      id: 'sub_test_002',
      customer: 'cus_test_002',
      status: 'trialing',
      current_period_start: 1700000000,
      current_period_end: 1702678400,
      cancel_at_period_end: true,
      items: {
        data: [
          { id: 'si_test_002', price: { id: 'price_starter', nickname: null } },
        ],
      },
    };

    expect(payload.items.data[0]?.price.nickname).toBeNull();
    expect(payload.cancel_at_period_end).toBe(true);
  });
});
