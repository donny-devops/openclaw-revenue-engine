import { Router, Request, Response } from 'express';

import { requireOperatorAuth } from '../middleware/auth';
import { handleMcpRequest, listMcpTools, McpRequest } from '../mcp/server';

const mcpRouter = Router();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

mcpRouter.get('/tools', (_req: Request, res: Response) => {
  res.json({ tools: listMcpTools() });
});

mcpRouter.post('/', requireOperatorAuth, async (req: Request, res: Response) => {
  const body = req.body as unknown;
  if (!isRecord(body) || typeof body.method !== 'string') {
    res.status(400).json({ error: 'Invalid MCP JSON-RPC payload' });
    return;
  }

  if (body.method === 'tools/call') {
    const params = body.params;
    if (
      !isRecord(params) ||
      typeof params.name !== 'string' ||
      ('arguments' in params && params.arguments !== undefined && !isRecord(params.arguments))
    ) {
      res.status(400).json({ error: 'Invalid MCP tool call payload' });
      return;
    }
  }

  const response = await handleMcpRequest(body as unknown as McpRequest);
  res.status(response.error ? 400 : 200).json(response);
});

export { mcpRouter };
