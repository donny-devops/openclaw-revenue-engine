import { createInterface } from 'readline';

import { handleMcpRequest, McpRequest } from './server';

const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: false });

rl.on('line', (line) => {
  void (async () => {
    try {
      const request = JSON.parse(line) as McpRequest;
      const response = await handleMcpRequest(request);
      process.stdout.write(`${JSON.stringify(response)}\n`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid MCP request';
      process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message } })}\n`);
    }
  })();
});
