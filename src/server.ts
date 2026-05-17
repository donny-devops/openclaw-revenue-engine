import http from 'http';

import app, { appConfig, logger } from './index';

const server = http.createServer(app);

server.listen(appConfig.port, () => {
  logger.info('[openclaw-revenue-engine] Listening', {
    port: appConfig.port,
    env: appConfig.nodeEnv,
    service: appConfig.serviceName,
    version: appConfig.version,
  });
});

function shutdown(signal: NodeJS.Signals): void {
  logger.info('[openclaw-revenue-engine] Shutdown signal received', { signal });

  server.close((error?: Error) => {
    if (error) {
      logger.error('[openclaw-revenue-engine] Error during shutdown', { error });
      process.exit(1);
    }

    logger.info('[openclaw-revenue-engine] Shutdown complete');
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
