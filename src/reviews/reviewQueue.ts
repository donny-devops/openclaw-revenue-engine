import crypto from 'crypto';

import { AgentRunResult } from '../agents/types';

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface ReviewItem {
  review_id: string;
  request_id: string;
  agent_id: string;
  risk_level: AgentRunResult['risk_level'];
  status: ReviewStatus;
  reason: string;
  findings: AgentRunResult['findings'];
  recommended_actions: string[];
  created_at: string;
  reviewed_at?: string;
  reviewer?: string;
  decision_note?: string;
}

const reviewItems: ReviewItem[] = [];

function buildReason(result: AgentRunResult): string {
  if (result.risk_level === 'critical') return 'Critical risk requires human review.';
  if (result.findings.length > 0) return 'Guardrail findings require human review.';
  return 'Model/profile policy requires human review.';
}

export function enqueueReview(result: AgentRunResult): ReviewItem | undefined {
  if (!result.human_review_required) return undefined;

  const existing = reviewItems.find((item) => item.request_id === result.request_id);
  if (existing) return existing;

  const item: ReviewItem = {
    review_id: crypto.randomUUID(),
    request_id: result.request_id,
    agent_id: result.agent_id,
    risk_level: result.risk_level,
    status: 'pending',
    reason: buildReason(result),
    findings: result.findings,
    recommended_actions: result.recommended_actions,
    created_at: new Date().toISOString(),
  };

  reviewItems.unshift(item);
  return item;
}

export function listReviews(status?: ReviewStatus): ReviewItem[] {
  return status ? reviewItems.filter((item) => item.status === status) : [...reviewItems];
}

export function getReview(reviewId: string): ReviewItem | undefined {
  return reviewItems.find((item) => item.review_id === reviewId);
}

export function decideReview(
  reviewId: string,
  status: Exclude<ReviewStatus, 'pending'>,
  reviewer: string,
  decisionNote?: string,
): ReviewItem {
  const item = getReview(reviewId);
  if (!item) throw new Error(`Unknown review_id: ${reviewId}`);
  if (item.status !== 'pending') throw new Error(`Review ${reviewId} has already been ${item.status}`);

  item.status = status;
  item.reviewed_at = new Date().toISOString();
  item.reviewer = reviewer;
  item.decision_note = decisionNote;
  return item;
}

export function clearReviewQueueForTests(): void {
  reviewItems.length = 0;
}
