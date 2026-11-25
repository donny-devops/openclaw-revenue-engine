import { Router, Request, Response } from 'express';

import { requireOperatorAuth } from '../middleware/auth';
import { handleMcpRequest, listMcpTools, McpRequest } from '../mcp/server';

const METHOD = /^[A-Za-z][A-Za-z0-9_./-]{0,63}$/;

const mcpRouter = Router();

function readMcpRequest(body: unknown): McpRequest | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  if (typeof record.method !== 'string' || !METHOD.test(record.method)) return null;
  if (record.id !== undefined && record.id !== null) {
    const idOk = typeof record.id === 'number'
      ? Number.isSafeInteger(record.id)
      : typeof record.id === 'string' && record.id.length > 0 && record.id.length <= 128;
    if (!idOk) return null;
  }
  return body as McpRequest;
}

mcpRouter.get('/tools', (_req: Request, res: Response) => {
  res.json({ tools: listMcpTools() });
});

mcpRouter.post('/', requireOperatorAuth, async (req: Request, res: Response) => {
  const body = readMcpRequest(req.body);
  if (!body) {
    res.status(400).json({ error: 'Invalid MCP JSON-RPC payload' });
    return;
  }

  const response = await handleMcpRequest(body);
  res.status(response.error ? 400 : 200).json(response);
});

export { mcpRouter };
