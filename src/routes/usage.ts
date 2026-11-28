import { Router, Request, Response } from 'express';
import { z } from 'zod';

import { UsageMetricType } from '../models';
import { requireOperatorAuth } from '../middleware/auth';
import { getUsageSummary, recordUsageEvent } from '../billing/usageMeter';

const tenantId = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

const usageEventSchema = z.object({
  tenant_id: tenantId,
  metric_type: z.enum(UsageMetricType),
  quantity: z.number().finite().nonnegative().max(1_000_000_000),
  unit: z.string().min(1).max(32).optional(),
  idempotency_key: z.string().min(1).max(128).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const usageRouter = Router();

usageRouter.post('/events', requireOperatorAuth, (req: Request, res: Response) => {
  const parsed = usageEventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid usage event payload', details: z.flattenError(parsed.error) });
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
  const raw = req.query.tenant_id;
  if (raw !== undefined && (typeof raw !== 'string' || !tenantId.safeParse(raw).success)) {
    res.status(400).json({ error: 'Invalid tenant_id' });
    return;
  }
  const tenant = typeof raw === 'string' ? raw : undefined;
  res.json({ summary: getUsageSummary(tenant) });
});

export { usageRouter };
