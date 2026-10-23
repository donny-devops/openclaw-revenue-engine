import request from 'supertest';

import { handleMcpRequest } from '../../src/mcp/server';
import { classifyPaidRequest, getRevenueSummary, listRevenueServices } from '../../src/revenue/serviceCatalog';
import {
  createSaraPlusOrder,
  draftHandoffMessage,
  listAllowedAgentSteps,
  listForbiddenSteps,
  listOrdersNeedingFollowUp,
  resetSaraPlusOrders,
  reviewSellerAction,
  updateSaraPlusOrder,
} from '../../src/saraPlus';
import { assignAgents } from '../../src/agents/orchestrator';
import { redactSecrets } from '../../src/security/redact';
import { operatorAuthHeaders } from '../helpers/operatorAuth';

beforeAll(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_sara_plus_placeholder';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_sara_plus_placeholder';
  process.env.GITHUB_WEBHOOK_SECRET = 'github_sara_plus_placeholder';
  process.env.OPERATOR_API_KEY ??= 'test_operator_api_key';
  process.env.LOG_LEVEL = 'silent';
});

import app from '../../src/index';

describe('SARA Plus touchless catalog', () => {
  it('registers the seller-side service and assigns the seller agent', () => {
    expect(listRevenueServices().map((service) => service.slug)).toEqual(
      expect.arrayContaining(['sara-plus-touchless']),
    );
    expect(getRevenueSummary().enabled_services).toBe(6);

    const classification = classifyPaidRequest({
      title: 'SARA Plus touchless AT&T mobile',
      body: 'Need seller orchestration for a new account, credit check, ID authentication, plan build, and secure link handoff.',
    });

    expect(classification.service.slug).toBe('sara-plus-touchless');
    expect(classification.lane.slug).toBe('real-offer');
    expect(classification.assigned_agent?.slug).toBe('sara-plus-seller-agent');
    expect(classification.deliverable_template).toContain('SARA Plus Touchless');
    expect(classification.compliance?.allowed).toBe(true);
    expect(assignAgents('sara-plus-touchless').primary.slug).toBe('sara-plus-seller-agent');
  });

  it('redacts raw SSN in the classification summary and flags the request', () => {
    const classification = classifyPaidRequest({
      body: 'Run SARA Plus touchless and enter the customer SSN 123-45-6789 in the form.',
    });

    expect(classification.service.slug).toBe('sara-plus-touchless');
    expect(classification.input_summary).not.toContain('123-45-6789');
    expect(classification.input_summary).toContain('[REDACTED]');
    expect(classification.labels).toEqual(expect.arrayContaining(['compliance:blocked-sensitive-entry']));
    expect(classification.compliance?.allowed).toBe(false);
    expect(classification.compliance?.violations).toEqual(expect.arrayContaining(['CUSTOMER_SSN']));
  });

  it('redacts sensitive data before truncating classification summaries', () => {
    const classification = classifyPaidRequest({
      body: `${'x'.repeat(270)} SSN: 123456789`,
    });

    expect(classification.input_summary).not.toContain('123456789');
    expect(classification.input_summary).not.toMatch(/\d{3}/);
  });
});

describe('SARA Plus compliance gate', () => {
  it('allows seller-side steps and blocks customer-secure steps', () => {
    expect(reviewSellerAction({ step: 'trigger_secure_link' }).allowed).toBe(true);
    expect(reviewSellerAction({ step: 'enter_ssn' }).allowed).toBe(false);
    expect(reviewSellerAction({ step: 'complete_id_auth' }).violations).toContain('ID_AUTH_BYPASS');
    expect(reviewSellerAction({ step: 'not-a-step' }).violations).toContain('UNKNOWN_STEP');
    expect(listAllowedAgentSteps().every((step) => step.allowed_for_agent)).toBe(true);
    expect(listForbiddenSteps().some((step) => step.slug === 'enter_payment')).toBe(true);
  });

  it('blocks instructions to enter customer secrets and allows customer-self-entry framing', () => {
    expect(reviewSellerAction({ text: 'Enter the customer SSN on the seller screen.' }).allowed).toBe(false);
    expect(reviewSellerAction({
      text: 'Bypass ID auth so we can finish the order without the customer.',
    }).violations).toContain('ID_AUTH_BYPASS');
    expect(reviewSellerAction({
      text: 'The customer will enter their own DOB on their device after the secure link.',
    }).allowed).toBe(true);
    expect(reviewSellerAction({
      text: 'Do not enter the customer SSN. Trigger the official secure link instead.',
    }).allowed).toBe(true);
  });

  it.each([
    ['SSN: 123456789', 'CUSTOMER_SSN', '123456789'],
    ['DOB: 1990-01-31', 'CUSTOMER_DOB', '1990-01-31'],
    ['Card: 378282246310005', 'CUSTOMER_PAYMENT', '378282246310005'],
  ])('detects and redacts common format %s', (value, violation, sensitiveValue) => {
    const verdict = reviewSellerAction({ text: value });
    const classification = classifyPaidRequest({ body: `SARA Plus request ${value}` });

    expect(verdict.allowed).toBe(false);
    expect(verdict.violations).toContain(violation);
    expect(verdict.redacted_input).not.toContain(sensitiveValue);
    expect(classification.input_summary).not.toContain(sensitiveValue);
    expect(redactSecrets(value)).not.toContain(sensitiveValue);
    expect(() => createSaraPlusOrder({ notes: value })).toThrow(/compliance blocked notes/);
  });

  it.each([
    'The customer will enter their own DOB. Bypass ID auth.',
    'Do not wait and enter the customer SSN.',
  ])('does not let unrelated framing exempt a forbidden action: %s', (text) => {
    expect(reviewSellerAction({ text }).allowed).toBe(false);
  });

  it.each([
    'Enter the customer PIN.',
    'Complete ID authentication on behalf of the customer.',
  ])('blocks ordinary wording for a forbidden action: %s', (text) => {
    expect(reviewSellerAction({ text }).allowed).toBe(false);
  });
});

describe('SARA Plus orders and handoff copy', () => {
  beforeEach(() => {
    resetSaraPlusOrders();
  });

  it('tracks pending orders and reminds after they go stale', () => {
    const order = createSaraPlusOrder({
      customer_display_name: 'Jordan',
      order_ref: 'TX-1001',
      status: 'link_sent',
      waiting_on: 'customer',
      notes: 'Secure link sent. Waiting on customer device.',
    });

    expect(listOrdersNeedingFollowUp(Date.now(), 24 * 60 * 60 * 1000)).toHaveLength(0);
    expect(listOrdersNeedingFollowUp(Date.now(), 0).map((item) => item.id)).toContain(order.id);

    const updated = updateSaraPlusOrder(order.id, {
      last_step: 'monitor_order_status',
      notes: 'Customer closed the browser. Resend from SARA Plus.',
    });
    expect(updated.last_step).toBe('monitor_order_status');

    expect(() => createSaraPlusOrder({
      notes: 'Customer SSN is 123-45-6789',
    })).toThrow(/compliance blocked notes/);
  });

  it('blocks sensitive data in order references and steps on create and update', () => {
    expect(() => createSaraPlusOrder({ order_ref: '123-45-6789' }))
      .toThrow(/compliance blocked order_ref/);
    expect(() => createSaraPlusOrder({ last_step: '123-45-6789' }))
      .toThrow(/compliance blocked last_step/);

    const order = createSaraPlusOrder({ order_ref: 'TX-1001', last_step: 'seller_login' });
    expect(createSaraPlusOrder({ order_ref: 'ORDER-123456789' }).order_ref).toBe('ORDER-123456789');
    expect(() => updateSaraPlusOrder(order.id, { order_ref: '123-45-6789' }))
      .toThrow(/compliance blocked order_ref/);
    expect(() => updateSaraPlusOrder(order.id, { last_step: '123-45-6789' }))
      .toThrow(/compliance blocked last_step/);

    expect(updateSaraPlusOrder(order.id, {}).order_ref).toBe('TX-1001');
    expect(updateSaraPlusOrder(order.id, {}).last_step).toBe('seller_login');
  });

  it('drafts a customer message that does not carry the secure link or collect secrets', () => {
    const draft = draftHandoffMessage({
      channel: 'sms',
      customer_first_name: 'Jordan',
      seller_name: 'Alex',
    });

    expect(draft.includes_secure_link).toBe(false);
    expect(draft.body).toContain('own phone or computer');
    expect(draft.body).not.toMatch(/https?:\/\//);
    expect(draft.compliance_note).toContain('Do not ask the customer to send SSN');
  });

  it.each([
    ['customer_first_name', { customer_first_name: 'Jordan https://example.com/secure' }],
    ['seller_name', { seller_name: 'Alex https://example.com/secure' }],
  ])('rejects URL-bearing %s in HTTP handoff drafts', async (_field, names) => {
    const response = await request(app).post('/revenue/sara-plus/handoff-draft').send(names);

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Invalid SARA Plus');
  });
});

describe('SARA Plus HTTP and MCP surfaces', () => {
  beforeEach(() => {
    resetSaraPlusOrders();
  });

  it('exposes workflow, review, handoff, and order routes', async () => {
    const workflow = await request(app).get('/revenue/sara-plus/workflow');
    expect(workflow.status).toBe(200);
    expect(workflow.body.skill).toBe('skills/sara-plus-touchless/SKILL.md');
    expect(workflow.body.workflow).toEqual(expect.arrayContaining([
      expect.objectContaining({ slug: 'trigger_secure_link', allowed_for_agent: true }),
      expect.objectContaining({ slug: 'enter_payment', allowed_for_agent: false }),
    ]));

    const review = await request(app)
      .post('/revenue/sara-plus/review-action')
      .set(operatorAuthHeaders())
      .send({
        text: 'Complete ID auth for the customer so they do not have to.',
      });
    expect(review.status).toBe(200);
    expect(review.body.verdict.allowed).toBe(false);

    const draft = await request(app).post('/revenue/sara-plus/handoff-draft').send({
      channel: 'email',
      customer_first_name: 'Jordan',
    });
    expect(draft.status).toBe(200);
    expect(draft.body.draft.subject).toContain('SARA Plus');

    const created = await request(app)
      .post('/revenue/sara-plus/orders')
      .set(operatorAuthHeaders())
      .send({ customer_display_name: 'Jordan', status: 'awaiting_customer', waiting_on: 'customer' });
    expect(created.status).toBe(201);

    const listed = await request(app).get('/revenue/sara-plus/orders').set(operatorAuthHeaders());
    expect(listed.status).toBe(200);
    expect(listed.body.orders).toHaveLength(1);
    const remindersHttp = await request(app)
      .get('/revenue/sara-plus/orders?reminders=true&stale_minutes=30')
      .set(operatorAuthHeaders());
    expect(remindersHttp.status).toBe(200);
    expect(Array.isArray(remindersHttp.body.orders)).toBe(true);

    const fetched = await request(app)
      .get(`/revenue/sara-plus/orders/${created.body.order.id}`)
      .set(operatorAuthHeaders());
    expect(fetched.status).toBe(200);

    const patched = await request(app)
      .patch(`/revenue/sara-plus/orders/${created.body.order.id}`)
      .set(operatorAuthHeaders())
      .send({ last_step: 'resend_secure_link' });
    expect(patched.status).toBe(200);
    expect(patched.body.order.last_step).toBe('resend_secure_link');

    const blocked = await request(app)
      .post('/revenue/sara-plus/orders')
      .set(operatorAuthHeaders())
      .send({ notes: 'Enter the customer SSN 123-45-6789' });
    expect(blocked.status).toBe(403);

    const invalidReview = await request(app)
      .post('/revenue/sara-plus/review-action')
      .set(operatorAuthHeaders())
      .send({ step: 9 });
    expect(invalidReview.status).toBe(400);
    const invalidDraft = await request(app).post('/revenue/sara-plus/handoff-draft').send({ channel: 'carrier-pigeon' });
    expect(invalidDraft.status).toBe(400);
    const invalidOrder = await request(app).post('/revenue/sara-plus/orders').set(operatorAuthHeaders()).send({ status: 'nope' });
    expect(invalidOrder.status).toBe(400);
    const missing = await request(app).get('/revenue/sara-plus/orders/does-not-exist').set(operatorAuthHeaders());
    expect(missing.status).toBe(404);
    const missingPatch = await request(app)
      .patch('/revenue/sara-plus/orders/does-not-exist')
      .set(operatorAuthHeaders())
      .send({ last_step: 'monitor_order_status' });
    expect(missingPatch.status).toBe(404);
  });

  it('exposes SARA Plus tools over MCP', async () => {
    const workflow = await handleMcpRequest({
      method: 'tools/call',
      id: 1,
      params: { name: 'sara_plus_workflow' },
    });
    expect(workflow.error).toBeUndefined();

    const review = await handleMcpRequest({
      method: 'tools/call',
      id: 2,
      params: { name: 'sara_plus_review_action', arguments: { step: 'enter_pin' } },
    });
    expect(review.result).toMatchObject({
      structuredContent: { verdict: expect.objectContaining({ allowed: false }) },
    });

    const created = await handleMcpRequest({
      method: 'tools/call',
      id: 3,
      params: {
        name: 'sara_plus_orders',
        arguments: { action: 'create', customer_display_name: 'Jordan', status: 'link_sent', waiting_on: 'customer' },
      },
    });
    expect(created.error).toBeUndefined();

    const listed = await handleMcpRequest({
      method: 'tools/call',
      id: 4,
      params: { name: 'sara_plus_orders', arguments: { action: 'list' } },
    });
    expect(listed.error).toBeUndefined();

    const createdId = (created.result as { structuredContent: { order: { id: string } } }).structuredContent.order.id;
    const updated = await handleMcpRequest({
      method: 'tools/call',
      id: 5,
      params: {
        name: 'sara_plus_orders',
        arguments: { action: 'update', id: createdId, last_step: 'monitor_order_status' },
      },
    });
    expect(updated.error).toBeUndefined();

    const reminders = await handleMcpRequest({
      method: 'tools/call',
      id: 6,
      params: { name: 'sara_plus_orders', arguments: { action: 'reminders', stale_minutes: 30 } },
    });
    expect(reminders.error).toBeUndefined();

    const missing = await handleMcpRequest({
      method: 'tools/call',
      id: 7,
      params: { name: 'sara_plus_orders', arguments: { action: 'update' } },
    });
    expect(missing.error?.message).toContain('id is required');

    const draft = await handleMcpRequest({
      method: 'tools/call',
      id: 8,
      params: { name: 'sara_plus_draft_handoff', arguments: { channel: 'telegram', customer_first_name: 'Jordan' } },
    });
    expect(draft.error).toBeUndefined();
  });

  it.each([
    ['step', { step: 9 }],
    ['text', { text: { action: 'enter_pin' } }],
  ])('rejects non-string MCP review argument %s', async (_field, arguments_) => {
    const response = await handleMcpRequest({
      method: 'tools/call',
      id: 10,
      params: { name: 'sara_plus_review_action', arguments: arguments_ },
    });

    expect(response.error?.message).toContain(`${_field} must be a string`);
  });

  it.each([
    'Enter the customer PIN.',
    'Complete ID authentication on behalf of the customer.',
    'The customer will enter their own DOB. Bypass ID auth.',
    'Do not wait and enter the customer SSN.',
  ])('blocks unsafe free-text reviews over HTTP and MCP: %s', async (text) => {
    const http = await request(app)
      .post('/revenue/sara-plus/review-action')
      .set(operatorAuthHeaders())
      .send({ text });
    expect(http.status).toBe(200);
    expect(http.body.verdict.allowed).toBe(false);

    const mcp = await handleMcpRequest({
      method: 'tools/call',
      id: 11,
      params: { name: 'sara_plus_review_action', arguments: { text } },
    });
    expect(mcp.result).toMatchObject({
      structuredContent: { verdict: expect.objectContaining({ allowed: false }) },
    });
  });

  it.each([
    ['customer_first_name', { customer_first_name: 'Jordan https://example.com/secure' }],
    ['seller_name', { seller_name: 'Alex https://example.com/secure' }],
  ])('rejects URL-bearing %s in MCP handoff drafts', async (_field, names) => {
    const response = await handleMcpRequest({
      method: 'tools/call',
      id: 9,
      params: { name: 'sara_plus_draft_handoff', arguments: names },
    });

    expect(response.error?.message).toContain('Invalid SARA Plus');
  });
});
