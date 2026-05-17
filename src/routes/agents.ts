import { Router, Request, Response } from 'express';
import { z } from 'zod';

import { listAgents, runAgent } from '../agents/runner';

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
    res.json(runAgent(parsed.data));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown agent runtime error';
    res.status(400).json({ error: message });
  }
});

export { agentsRouter };
