import { Router, Request, Response } from 'express';

import { requireOperatorAuth } from '../middleware/auth';
import { handleMcpRequest, listMcpTools, McpRequest } from '../mcp/server';

const mcpRouter = Router();

mcpRouter.get('/tools', (_req: Request, res: Response) => {
  res.json({ tools: listMcpTools() });
});

mcpRouter.post('/', requireOperatorAuth, async (req: Request, res: Response) => {
  const body = req.body as McpRequest;
  if (!body || typeof body.method !== 'string') {
    res.status(400).json({ error: 'Invalid MCP JSON-RPC payload' });
    return;
  }

  const response = await handleMcpRequest(body);
  res.status(response.error ? 400 : 200).json(response);
});

export { mcpRouter };
