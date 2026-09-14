import { Router, Request, Response } from 'express';
import { z } from 'zod';

import { requireOperatorAuth } from '../middleware/auth';
import { handleMcpRequest, listMcpTools, McpRequest } from '../mcp/server';

const mcpRouter = Router();

const mcpRequestSchema = z.object({
  jsonrpc: z.literal('2.0').optional(),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
  method: z.string().min(1),
  params: z.object({
    name: z.string().min(1).optional(),
    arguments: z.record(z.unknown()).optional(),
  }).optional(),
});

mcpRouter.get('/tools', (_req: Request, res: Response) => {
  res.json({ tools: listMcpTools() });
});

mcpRouter.post('/', requireOperatorAuth, async (req: Request, res: Response) => {
  const parsed = mcpRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid MCP JSON-RPC payload' });
    return;
  }

  const response = await handleMcpRequest(parsed.data as McpRequest);
  res.status(response.error ? 400 : 200).json(response);
});

export { mcpRouter };
