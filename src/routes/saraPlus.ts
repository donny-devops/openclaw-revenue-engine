import { Router, Request, Response } from 'express';
import { z } from 'zod';

import { requireOperatorAuth } from '../middleware/auth';
import {
  createSaraPlusOrder,
  draftHandoffMessage,
  getSaraPlusOrder,
  getWorkflow,
  listOrdersNeedingFollowUp,
  listSaraPlusOrders,
  reviewSellerAction,
  SARA_PLUS_SKILL_PATH,
  updateSaraPlusOrder,
} from '../saraPlus';

const shortText = z.string().trim().min(1).max(120);
const notesText = z.string().max(4000);

const reviewSchema = z.object({
  step: shortText.optional(),
  text: notesText.optional(),
});

const handoffSchema = z.object({
  channel: z.enum(['sms', 'email', 'telegram', 'slack', 'discord']).optional(),
  customer_first_name: shortText.optional(),
  seller_name: shortText.optional(),
});

const orderSchema = z.object({
  customer_display_name: shortText.optional(),
  order_ref: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).optional(),
  status: z.enum([
    'seller_prep',
    'awaiting_secure_link',
    'link_sent',
    'awaiting_customer',
    'customer_complete',
    'seller_advance',
    'blocked_compliance',
  ]).optional(),
  last_step: shortText.optional(),
  waiting_on: z.enum(['seller', 'customer', 'id_auth', 'none']).optional(),
  notes: notesText.optional(),
});

const orderIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);

const saraPlusRouter = Router();

const complianceStatus = (message: string): number => {
  if (message.includes('compliance')) return 403;
  if (message.includes('Unknown SARA Plus order')) return 404;
  return 400;
};

saraPlusRouter.get('/workflow', (_req: Request, res: Response) => {
  res.json({
    skill: SARA_PLUS_SKILL_PATH,
    workflow: getWorkflow(),
  });
});

saraPlusRouter.post('/review-action', requireOperatorAuth, (req: Request, res: Response) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid SARA Plus review payload', details: parsed.error.flatten() });
    return;
  }

  res.json({ verdict: reviewSellerAction(parsed.data) });
});

saraPlusRouter.post('/handoff-draft', (req: Request, res: Response) => {
  const parsed = handoffSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid SARA Plus handoff payload', details: parsed.error.flatten() });
    return;
  }

  try {
    res.json({ draft: draftHandoffMessage(parsed.data) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown SARA Plus handoff error';
    res.status(complianceStatus(message)).json({ error: message });
  }
});

saraPlusRouter.get('/orders', requireOperatorAuth, (req: Request, res: Response) => {
  if (req.query.reminders === 'true') {
    const raw = req.query.stale_minutes;
    let staleMs: number | undefined;
    if (raw !== undefined) {
      const staleMinutes = Number(raw);
      if (!Number.isFinite(staleMinutes) || staleMinutes < 1 || staleMinutes > 10_080) {
        res.status(400).json({ error: 'stale_minutes must be between 1 and 10080' });
        return;
      }
      staleMs = staleMinutes * 60 * 1000;
    }
    res.json({ orders: listOrdersNeedingFollowUp(Date.now(), staleMs) });
    return;
  }

  res.json({ orders: listSaraPlusOrders() });
});

saraPlusRouter.post('/orders', requireOperatorAuth, (req: Request, res: Response) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid SARA Plus order payload', details: parsed.error.flatten() });
    return;
  }

  try {
    res.status(201).json({ order: createSaraPlusOrder(parsed.data) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown SARA Plus order error';
    res.status(complianceStatus(message)).json({ error: message });
  }
});

const orderId = (req: Request): string | undefined => {
  const value = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = orderIdSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
};

saraPlusRouter.patch('/orders/:id', requireOperatorAuth, (req: Request, res: Response) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid SARA Plus order payload', details: parsed.error.flatten() });
    return;
  }

  const id = orderId(req);
  if (!id) {
    res.status(400).json({ error: 'Order id is required' });
    return;
  }

  try {
    res.json({ order: updateSaraPlusOrder(id, parsed.data) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown SARA Plus order error';
    res.status(complianceStatus(message)).json({ error: message });
  }
});

saraPlusRouter.get('/orders/:id', requireOperatorAuth, (req: Request, res: Response) => {
  const id = orderId(req);
  const order = id ? getSaraPlusOrder(id) : undefined;
  if (!order) {
    res.status(404).json({ error: 'SARA Plus order not found' });
    return;
  }
  res.json({ order });
});

export { saraPlusRouter };
