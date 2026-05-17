import { Response } from 'express';

export function sendBadRequest(res: Response, error: string): void {
  res.status(400).json({ error });
}

export function sendUnauthorized(res: Response, error: string): void {
  res.status(401).json({ error });
}

export function sendServiceMisconfigured(res: Response, provider: string): void {
  res.status(500).json({ error: `${provider} webhook is not configured` });
}

export function sendWebhookProcessingError(res: Response): void {
  res.status(500).json({ error: 'Internal webhook processing error' });
}

export function getHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
