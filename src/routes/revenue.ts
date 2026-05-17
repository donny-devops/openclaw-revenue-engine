import { Router, Request, Response } from 'express';
import { z } from 'zod';

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

const revenueRouter = Router();

const isInputError = (message: string): boolean => {
  return (
    message.includes('required') ||
    message.includes('Unknown or disabled') ||
    message.includes('max_input_chars')
  );
};

revenueRouter.get('/summary', (_req: Request, res: Response) => {
  res.json({ summary: getRevenueSummary() });
});

revenueRouter.get('/lanes', (_req: Request, res: Response) => {
  res.json({ lanes: listRevenueLanes() });
});

revenueRouter.get('/services', (_req: Request, res: Response) => {
  res.json({ services: listRevenueServices() });
});

revenueRouter.get('/openclaw', (_req: Request, res: Response) => {
  res.json({ openclaw: loadOpenClawConfig() });
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

export { revenueRouter };
