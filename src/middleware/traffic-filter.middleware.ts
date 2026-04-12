import { Request, Response, NextFunction } from 'express';

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 200;

const requestCounts = new Map<string, { count: number; resetAt: number }>();

// Known probe/scanner paths to block
const PROBE_PATHS = [
  '/.env',
  '/wp-admin',
  '/wp-login',
  '/phpMyAdmin',
  '/.git',
  '/actuator',
  '/admin',
  '/config',
];

export function trafficFilter(req: Request, res: Response, next: NextFunction): void {
  const path = req.path.toLowerCase();

  // Block probe paths
  if (PROBE_PATHS.some((p) => path.startsWith(p))) {
    res.status(403).json({ statusCode: 403, error: 'Forbidden', message: 'Access denied.' });
    return;
  }

  // Rate limiting by IP
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = requestCounts.get(ip);

  if (!entry || now > entry.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }

  entry.count++;
  if (entry.count > MAX_REQUESTS) {
    res.status(429).json({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Try again later.',
    });
    return;
  }

  next();
}
