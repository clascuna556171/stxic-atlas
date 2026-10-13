import type { RequestHandler } from 'express';

const loopback = (hostname: string) => hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
function localUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' && loopback(url.hostname) && !url.username && !url.password;
  } catch { return false; }
}

// Binding to loopback alone doesn't stop a malicious website or DNS rebinding.
export const localRequestGuard: RequestHandler = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  if (!localUrl(`http://${req.headers.host ?? ''}`) || (req.headers.origin && !localUrl(req.headers.origin)) || req.headers['sec-fetch-site'] === 'cross-site') {
    res.status(403).json({ error: 'Only requests from the local workspace are allowed.' });
    return;
  }
  if (req.path.startsWith('/api')) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'POST' && !req.is('application/json')) {
      res.status(415).json({ error: 'Use application/json for local API requests.' });
      return;
    }
  }
  next();
};
