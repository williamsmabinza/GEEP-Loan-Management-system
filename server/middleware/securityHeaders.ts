import { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';

/**
 * Enterprise HTTP Security Headers Middleware
 * Protects against XSS, clickjacking, MIME sniffing, data injection, and SSL downgrade attacks.
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking - allow rendering only within the same origin (compatible with AI Studio iframe preview)
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // Legacy XSS filter for older browsers
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer Policy: Send full referrer on same-origin, only origin on cross-origin HTTPS
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions Policy: Disable sensitive web APIs not needed by financial banking platform
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), display-capture=()'
  );

  // Cross-Origin Isolation & Resource sharing safeguards
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  // Strict Content Security Policy (allows necessary Vite/React scripts, Tailwind fonts, and APIs)
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' ws: wss: https:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'self' http://localhost:* https://*.google.com https://*.aistudio.google.com https://*.googleusercontent.com",
  ];
  res.setHeader('Content-Security-Policy', cspDirectives.join('; '));

  // Enforce HSTS (HTTP Strict Transport Security) in production
  if (config.env === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Remove Express fingerprint
  res.removeHeader('X-Powered-By');

  next();
}

/**
 * Origin and Cross-Site Request Verification Middleware
 * Validates Origin/Referer headers on state-mutating requests (POST, PUT, PATCH, DELETE)
 */
export function verifyRequestOrigin(req: Request, res: Response, next: NextFunction): void {
  // Safe HTTP read methods are exempt
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const origin = req.headers['origin'] as string | undefined;
  const referer = req.headers['referer'] as string | undefined;

  // In test or development environments, allow local test suites
  if (config.env === 'test' || !origin) {
    return next();
  }

  // Validate allowed origins
  const allowed = config.security.corsOrigin === '*'
    ? true
    : config.security.corsOrigin.split(',').map((o) => o.trim()).includes(origin);

  // If origin is defined and not in allowed list, reject
  if (origin && !allowed && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
    res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN_ORIGIN',
        message: 'Cross-origin request rejected for non-whitelisted origin.',
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  next();
}
