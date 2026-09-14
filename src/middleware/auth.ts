import { timingSafeEqual } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { isProduction } from '../lib/env';

const safeEqual = (left: string, right: string): boolean => {
  const leftBuf = Buffer.from(left);
  const rightBuf = Buffer.from(right);
  if (leftBuf.length !== rightBuf.length) {
    return false;
  }
  return timingSafeEqual(leftBuf, rightBuf);
};

const readBearer = (req: Request): string | undefined => {
  const header = req.headers.authorization;
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) return undefined;
  const trimmed = value.trim();
  if (trimmed.slice(0, 6).toLowerCase() !== 'bearer') {
    return undefined;
  }
  const token = trimmed.slice(6).trim();
  return token.length > 0 ? token : undefined;
};

export function requireOperatorAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = process.env.OPERATOR_API_KEY;
  const jwtSecret = process.env.JWT_SECRET;
  const token = readBearer(req);

  if (!apiKey && !jwtSecret) {
    if (isProduction()) {
      res.status(503).json({ error: 'Operator authentication is not configured' });
      return;
    }
    next();
    return;
  }

  if (!token) {
    res.status(401).json({ error: 'Missing Authorization bearer token' });
    return;
  }

  if (apiKey && safeEqual(token, apiKey)) {
    next();
    return;
  }

  if (jwtSecret) {
    try {
      jwt.verify(token, jwtSecret);
      next();
      return;
    } catch {
      res.status(401).json({ error: 'Invalid operator token' });
      return;
    }
  }

  res.status(401).json({ error: 'Invalid operator token' });
}
