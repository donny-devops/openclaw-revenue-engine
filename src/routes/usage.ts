import { Router, Request, Response } from 'express';
import { z } from 'zod';

import { UsageMetricType } from '../models';
import { requireOperatorAuth } from '../middleware/auth';
import { getUsageSummary, recordUsageEvent } from '../billing/usageMeter';

const usageEventSchema = z.object({
  tenant_id: z.string().min(1),
  metric_type: z.nativeEnum(UsageMetricType),
  quantity: z.number().nonnegative(),
  unit: z.string().min(1).optional(),
  idempotency_key: z.string().min(1).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const usageRouter = Router();

usageRouter.post('/events', requireOperatorAuth, (req: Request, res: Response) => {
  const parsed = usageEventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid usage event payload', details: parsed.error.flatten() });
    return;
  }

  try {
    const event = recordUsageEvent(parsed.data);
    res.status(201).json({ event });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown usage error';
    res.status(400).json({ error: message });
  }
});

usageRouter.get('/summary', requireOperatorAuth, (req: Request, res: Response) => {
  const tenantId = typeof req.query.tenant_id === 'string' ? req.query.tenant_id : undefined;
  if (!tenantId?.trim()) {
    res.status(400).json({ error: 'tenant_id is required' });
    return;
  }
  res.json({ summary: getUsageSummary(tenantId) });
});

export { usageRouter };
