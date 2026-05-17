import request from 'supertest';

import { clearAgentAuditLogForTests } from '../../src/agents/auditLog';
import { clearReviewQueueForTests } from '../../src/reviews/reviewQueue';

beforeAll(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_agent_ops_placeholder';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_agent_ops_placeholder';
  process.env.GITHUB_WEBHOOK_SECRET = 'github_agent_ops_placeholder';
  process.env.LOG_LEVEL = 'silent';
});

import app from '../../src/index';

describe('agent operations routes', () => {
  beforeEach(() => {
    clearAgentAuditLogForTests();
    clearReviewQueueForTests();
  });

  it('records agent runs and exposes run history', async () => {
    const run = await request(app).post('/agents/run').send({
      request_id: 'req-audit-1',
      agent_id: 'revenue_ops_agent',
      objective: 'Summarize webhook health check status',
    });

    expect(run.status).toBe(200);
    expect(run.body.audit).toMatchObject({
      request_id: 'req-audit-1',
      agent_id: 'revenue_ops_agent',
      risk_level: 'low',
    });

    const list = await request(app).get('/agents/runs');
    expect(list.status).toBe(200);
    expect(list.body.runs).toHaveLength(1);
    expect(list.body.runs[0]).toMatchObject({ request_id: 'req-audit-1' });

    const getOne = await request(app).get('/agents/runs/req-audit-1');
    expect(getOne.status).toBe(200);
    expect(getOne.body.run).toMatchObject({ request_id: 'req-audit-1' });
  });

  it('returns 404 for missing agent audit records', async () => {
    const res = await request(app).get('/agents/runs/missing');
    expect(res.status).toBe(404);
    expect(res.body.error).toContain('Unknown request_id');
  });

  it('creates a pending review when an agent run requires human review', async () => {
    const run = await request(app).post('/agents/run').send({
      request_id: 'req-review-1',
      agent_id: 'compliance_review_agent',
      objective: 'Review refund and customer impact for chargeback workflow',
    });

    expect(run.status).toBe(200);
    expect(run.body.human_review_required).toBe(true);
    expect(run.body.review).toMatchObject({
      request_id: 'req-review-1',
      status: 'pending',
      risk_level: 'high',
    });

    const pending = await request(app).get('/reviews/pending');
    expect(pending.status).toBe(200);
    expect(pending.body.reviews).toHaveLength(1);
  });

  it('approves a pending review exactly once', async () => {
    const run = await request(app).post('/agents/run').send({
      request_id: 'req-review-approve',
      agent_id: 'compliance_review_agent',
      objective: 'Review refund and customer impact for chargeback workflow',
    });

    const reviewId = run.body.review.review_id as string;
    const approved = await request(app).post(`/reviews/${reviewId}/approve`).send({
      reviewer: 'ops-lead',
      decision_note: 'Reviewed evidence and approved follow-up.',
    });

    expect(approved.status).toBe(200);
    expect(approved.body.review).toMatchObject({
      review_id: reviewId,
      status: 'approved',
      reviewer: 'ops-lead',
    });

    const duplicate = await request(app).post(`/reviews/${reviewId}/approve`).send({
      reviewer: 'ops-lead',
    });
    expect(duplicate.status).toBe(400);
    expect(duplicate.body.error).toContain('already been approved');
  });

  it('rejects a pending review', async () => {
    const run = await request(app).post('/agents/run').send({
      request_id: 'req-review-reject',
      agent_id: 'compliance_review_agent',
      objective: 'Review refund and customer impact for chargeback workflow',
    });

    const reviewId = run.body.review.review_id as string;
    const rejected = await request(app).post(`/reviews/${reviewId}/reject`).send({
      reviewer: 'security-reviewer',
      decision_note: 'Insufficient evidence.',
    });

    expect(rejected.status).toBe(200);
    expect(rejected.body.review).toMatchObject({
      review_id: reviewId,
      status: 'rejected',
      reviewer: 'security-reviewer',
    });
  });

  it('validates review decision payloads', async () => {
    const res = await request(app).post('/reviews/missing/approve').send({ reviewer: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid review decision payload');
  });
});
