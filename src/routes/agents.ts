import { Router, Request, Response } from 'express';
import { z } from 'zod';

import { getAgentRun, listAgentRuns, recordAgentRun } from '../agents/auditLog';
import { listAgents, runAgent } from '../agents/runner';
import { enqueueReview } from '../reviews/reviewQueue';

const runAgentSchema = z.object({
  request_id: z.string().optional(),
  agent_id: z.string().min(1),
  objective: z.string().min(1),
  event_summary: z.string().optional(),
  context: z.record(z.unknown()).optional(),
});

const agentsRouter = Router();

agentsRouter.get('/', (_req: Request, res: Response) => {
  res.json({ agents: listAgents() });
});

agentsRouter.get('/runs', (req: Request, res: Response) => {
  const rawLimit = typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : 50;
  const limit = Number.isFinite(rawLimit) ? rawLimit : 50;
  res.json({ runs: listAgentRuns(limit) });
});

agentsRouter.get('/runs/:requestId', (req: Request, res: Response) => {
  const record = getAgentRun(req.params.requestId);
  if (!record) {
    res.status(404).json({ error: `Unknown request_id: ${req.params.requestId}` });
    return;
  }
  res.json({ run: record });
});

agentsRouter.post('/run', (req: Request, res: Response) => {
  const parsed = runAgentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid agent run payload',
      details: parsed.error.flatten(),
    });
    return;
  }

  try {
    const result = runAgent(parsed.data);
    const audit = recordAgentRun(parsed.data, result);
    const review = enqueueReview(result);
    res.json({ ...result, audit, review });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown agent runtime error';
    res.status(400).json({ error: message });
  }
});

export { agentsRouter };
