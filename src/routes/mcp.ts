import { Router, Request, Response } from 'express';

import { requireOperatorAuth } from '../middleware/auth';
import { handleMcpRequest, listMcpTools, McpRequest, validateMcpRequest } from '../mcp/server';

const mcpRouter = Router();

mcpRouter.get('/tools', (_req: Request, res: Response) => {
  res.json({ tools: listMcpTools() });
});

mcpRouter.post('/', requireOperatorAuth, async (req: Request, res: Response) => {
  const body = req.body as unknown;
  if (Array.isArray(body)) {
    if (body.length === 0) {
      res.status(400).json({ error: 'Invalid MCP JSON-RPC payload' });
      return;
    }

    const error = body.map(validateMcpRequest).find((message) => message !== undefined);
    if (error) {
      res.status(400).json({ error });
      return;
    }

    const responses = await Promise.all(body.map((item) => handleMcpRequest(item as McpRequest)));
    res.status(200).json(responses);
    return;
  }

  const error = validateMcpRequest(body);
  if (error) {
    res.status(400).json({ error });
    return;
  }

  const response = await handleMcpRequest(body as unknown as McpRequest);
  res.status(response.error ? 400 : 200).json(response);
});

export { mcpRouter };
