import { Router, Request, Response } from 'express';

import { getMcpServer, viewMcpServers } from '../mcp/registry';

const mcpRouter = Router();

mcpRouter.get('/servers', (_req: Request, res: Response) => {
  res.json({ servers: viewMcpServers() });
});

mcpRouter.get('/servers/:serverId', (req: Request, res: Response) => {
  try {
    const server = getMcpServer(req.params.serverId);
    const missingEnv = server.required_env.filter((key) => !process.env[key]);
    res.json({
      server: {
        id: server.id,
        name: server.name,
        transport: server.transport,
        allowed_capabilities: server.allowed_capabilities,
        blocked_capabilities: server.blocked_capabilities,
        purpose: server.purpose,
        configured: missingEnv.length === 0,
        missing_env: missingEnv,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown MCP runtime error';
    res.status(404).json({ error: message });
  }
});

export { mcpRouter };
