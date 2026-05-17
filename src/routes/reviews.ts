import { Router, Request, Response } from 'express';
import { z } from 'zod';

import { decideReview, getReview, listReviews, ReviewStatus } from '../reviews/reviewQueue';

const decisionSchema = z.object({
  reviewer: z.string().min(1),
  decision_note: z.string().optional(),
});

function parseReviewStatus(value: unknown): ReviewStatus | undefined {
  if (value === 'pending' || value === 'approved' || value === 'rejected') return value;
  return undefined;
}

const reviewsRouter = Router();

reviewsRouter.get('/', (req: Request, res: Response) => {
  const status = parseReviewStatus(req.query.status);
  res.json({ reviews: listReviews(status) });
});

reviewsRouter.get('/pending', (_req: Request, res: Response) => {
  res.json({ reviews: listReviews('pending') });
});

reviewsRouter.get('/:reviewId', (req: Request, res: Response) => {
  const review = getReview(req.params.reviewId);
  if (!review) {
    res.status(404).json({ error: `Unknown review_id: ${req.params.reviewId}` });
    return;
  }
  res.json({ review });
});

reviewsRouter.post('/:reviewId/approve', (req: Request, res: Response) => {
  const parsed = decisionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid review decision payload', details: parsed.error.flatten() });
    return;
  }

  try {
    const review = decideReview(req.params.reviewId, 'approved', parsed.data.reviewer, parsed.data.decision_note);
    res.json({ review });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown review decision error';
    res.status(400).json({ error: message });
  }
});

reviewsRouter.post('/:reviewId/reject', (req: Request, res: Response) => {
  const parsed = decisionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid review decision payload', details: parsed.error.flatten() });
    return;
  }

  try {
    const review = decideReview(req.params.reviewId, 'rejected', parsed.data.reviewer, parsed.data.decision_note);
    res.json({ review });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown review decision error';
    res.status(400).json({ error: message });
  }
});

export { reviewsRouter };
