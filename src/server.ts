import app, { logger } from './index';

const PORT = Number(process.env.PORT ?? 3000);

app.listen(PORT, () => {
  logger.info(`[openclaw-revenue-engine] Listening on port ${PORT}`);
});
