import app, { logger } from './index';

function listenPort(): number {
  const raw = process.env.PORT ?? '3000';
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    logger.error('PORT must be an integer between 1 and 65535', { port: raw });
    process.exit(1);
  }
  return port;
}

const PORT = listenPort();

const server = app.listen(PORT, () => {
  logger.info(`[openclaw-revenue-engine] Listening on port ${PORT}`);
});

function shutdown(signal: string): void {
  logger.info(`${signal} received; shutting down HTTP server`);
  server.close((err) => {
    if (err) {
      logger.error('HTTP server close failed', { message: err.message });
      process.exit(1);
    }
    logger.info('HTTP server closed');
    process.exit(0);
  });
  setTimeout(() => {
    logger.error('Forced shutdown after 10s');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', {
    message: reason instanceof Error ? reason.message : String(reason),
  });
});

export default server;
