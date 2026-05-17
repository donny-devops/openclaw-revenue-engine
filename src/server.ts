import app, { logger } from './index';

const PORT = process.env.PORT ?? 3000;

const server = app.listen(PORT, () => {
  logger.info(`[openclaw-revenue-engine] Listening on port ${PORT}`);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received; shutting down HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
  });
});

export default server;
