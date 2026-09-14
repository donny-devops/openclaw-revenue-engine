import { Router, Request, Response } from 'express';
import { z } from 'zod';

import { listEnabledAgents } from '../agents/orchestrator';
import { createLaneCheckout, simulatePaymentCollection } from '../billing/checkout';
import { getEarningsSnapshot, getPayment, listPayments } from '../billing/ledger';
import { requireOperatorAuth } from '../middleware/auth';
import { loadOpenClawConfig } from '../revenue/config';
import {
  classifyPaidRequest,
  getRevenueSummary,
  listRevenueLanes,
  listRevenueServices,
} from '../revenue/serviceCatalog';

const paidRequestSchema = z.object({
  title: z.string().optional(),
  body: z.string().min(1),
  lane: z.string().optional(),
  service: z.string().optional(),
  customer_email: z.string().email().optional(),
  source: z.string().optional(),
});

const checkoutSchema = paidRequestSchema.extend({
  customer_email: z.string().email(),
  success_url: z.string().url().optional(),
  cancel_url: z.string().url().optional(),
});

const revenueRouter = Router();

const isInputError = (message: string): boolean => {
  return (
    message.includes('required') ||
    message.includes('Unknown or disabled') ||
    message.includes('max_input_chars')
  );
};

revenueRouter.get('/summary', (_req: Request, res: Response) => {
  res.json({
    summary: getRevenueSummary(),
    earnings: getEarningsSnapshot(),
  });
});

revenueRouter.get('/lanes', (_req: Request, res: Response) => {
  res.json({ lanes: listRevenueLanes() });
});

revenueRouter.get('/services', (_req: Request, res: Response) => {
  res.json({ services: listRevenueServices() });
});

revenueRouter.get('/agents', (_req: Request, res: Response) => {
  res.json({ agents: listEnabledAgents() });
});

revenueRouter.get('/openclaw', (_req: Request, res: Response) => {
  res.json({ openclaw: loadOpenClawConfig() });
});

revenueRouter.get('/earnings', requireOperatorAuth, (_req: Request, res: Response) => {
  res.json({ earnings: getEarningsSnapshot() });
});

revenueRouter.get('/payments', requireOperatorAuth, (_req: Request, res: Response) => {
  res.json({ payments: listPayments() });
});

revenueRouter.get('/payments/:id', requireOperatorAuth, (req: Request, res: Response) => {
  const payment = getPayment(req.params.id);
  if (!payment) {
    res.status(404).json({ error: 'Payment not found' });
    return;
  }
  res.json({ payment });
});

revenueRouter.post('/payments/:id/collect', requireOperatorAuth, (req: Request, res: Response) => {
  try {
    const payment = simulatePaymentCollection(req.params.id);
    res.json({ payment });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown collection error';
    const status = message.includes('production') ? 403 : message.includes('Unknown') ? 404 : 400;
    res.status(status).json({ error: message });
  }
});

revenueRouter.post('/classify', (req: Request, res: Response) => {
  const parsed = paidRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid paid request payload', details: parsed.error.flatten() });
    return;
  }

  try {
    res.json({ classification: classifyPaidRequest(parsed.data) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown revenue classification error';
    const status = isInputError(message) ? 400 : 500;
    res.status(status).json({ error: status === 400 ? message : 'Revenue configuration error' });
  }
});

revenueRouter.post('/checkout', async (req: Request, res: Response) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid checkout payload', details: parsed.error.flatten() });
    return;
  }

  try {
    const checkout = await createLaneCheckout(parsed.data);
    res.status(201).json(checkout);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown checkout error';
    const status = isInputError(message) || message.includes('customer_email') ? 400 : 502;
    res.status(status).json({ error: status === 400 ? message : 'Checkout provider error' });
  }
});

export { revenueRouter };
