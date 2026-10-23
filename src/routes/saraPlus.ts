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

const reviewSchema = z.object({
  step: z.string().optional(),
  text: z.string().optional(),
});

const handoffSchema = z.object({
  channel: z.enum(['sms', 'email', 'telegram', 'slack', 'discord']).optional(),
  customer_first_name: z.string().optional(),
  seller_name: z.string().optional(),
});

const orderSchema = z.object({
  customer_display_name: z.string().optional(),
  order_ref: z.string().optional(),
  status: z.enum([
    'seller_prep',
    'awaiting_secure_link',
    'link_sent',
    'awaiting_customer',
    'customer_complete',
    'seller_advance',
    'blocked_compliance',
  ]).optional(),
  last_step: z.string().optional(),
  waiting_on: z.enum(['seller', 'customer', 'id_auth', 'none']).optional(),
  notes: z.string().optional(),
});

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
  const staleMinutes = Number(req.query.stale_minutes);
  if (req.query.reminders === 'true') {
    const staleMs = Number.isFinite(staleMinutes) && staleMinutes > 0
      ? staleMinutes * 60 * 1000
      : undefined;
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
  const value = req.params.id;
  return typeof value === 'string' && value.trim() ? value : undefined;
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
