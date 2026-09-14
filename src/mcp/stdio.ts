import { createInterface } from 'readline';

import { handleMcpRequest, McpRequest, validateMcpRequest } from './server';

const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: false });

rl.on('line', (line) => {
  void (async () => {
    try {
      const request = JSON.parse(line) as unknown;
      if (Array.isArray(request)) {
        if (request.length === 0) {
          throw new Error('Invalid MCP JSON-RPC payload');
        }

        const error = request.map(validateMcpRequest).find((message) => message !== undefined);
        if (error) {
          throw new Error(error);
        }

        const responses = await Promise.all(request.map((item) => handleMcpRequest(item as McpRequest)));
        process.stdout.write(`${JSON.stringify(responses)}\n`);
        return;
      }

      const error = validateMcpRequest(request);
      if (error) {
        throw new Error(error);
      }

      const response = await handleMcpRequest(request as McpRequest);
      process.stdout.write(`${JSON.stringify(response)}\n`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid MCP request';
      process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message } })}\n`);
    }
  })();
});
