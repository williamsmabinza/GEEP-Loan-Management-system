import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

interface RateLimitRecord {
  timestamps: number[];
}

interface RateLimiterOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max allowable requests per window
  message?: string;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
}

/**
 * In-memory sliding-window log rate limiter with automatic cleanup
 */
export class MemoryRateLimiter {
  private clients = new Map<string, RateLimitRecord>();
  private windowMs: number;
  private maxRequests: number;
  private message: string;
  private keyGenerator: (req: Request) => string;
  private skip: (req: Request) => boolean;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(options: RateLimiterOptions) {
    this.windowMs = options.windowMs;
    this.maxRequests = options.maxRequests;
    this.message = options.message || 'Too many requests. Please try again later.';
    this.keyGenerator = options.keyGenerator || ((req: Request) => {
      const forwarded = req.headers['x-forwarded-for'];
      const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '') ||
        req.socket.remoteAddress ||
        '127.0.0.1';
      return `${ip}:${req.path}`;
    });
    this.skip = options.skip || (() => process.env.NODE_ENV === 'test' && !process.env.TEST_RATE_LIMIT);

    // Garbage collection of expired IP buckets every 60 seconds
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, record] of this.clients.entries()) {
        const active = record.timestamps.filter((ts) => now - ts < this.windowMs);
        if (active.length === 0) {
          this.clients.delete(key);
        } else {
          record.timestamps = active;
        }
      }
    }, 60_000);

    // Allow process exit without keeping loop active
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  public resetKey(key: string): void {
    this.clients.delete(key);
  }

  public resetAll(): void {
    this.clients.clear();
  }

  public middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (this.skip(req)) {
        return next();
      }

      const key = this.keyGenerator(req);
      const now = Date.now();

      let record = this.clients.get(key);
      if (!record) {
        record = { timestamps: [] };
        this.clients.set(key, record);
      }

      // Filter timestamps outside current rolling window
      record.timestamps = record.timestamps.filter((ts) => now - ts < this.windowMs);

      const requestCount = record.timestamps.length;
      const remaining = Math.max(0, this.maxRequests - requestCount - 1);
      const oldestTimestamp = record.timestamps[0] || now;
      const resetTimeSeconds = Math.ceil((oldestTimestamp + this.windowMs - now) / 1000);

      res.setHeader('RateLimit-Limit', this.maxRequests);
      res.setHeader('RateLimit-Remaining', remaining);
      res.setHeader('RateLimit-Reset', Math.max(0, resetTimeSeconds));

      if (requestCount >= this.maxRequests) {
        logger.warn(`Rate limit triggered for key [${key}] on ${req.method} ${req.originalUrl}`);
        res.setHeader('Retry-After', Math.max(1, resetTimeSeconds));
        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: this.message,
            retryAfterSeconds: Math.max(1, resetTimeSeconds),
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Record valid hit
      record.timestamps.push(now);
      next();
    };
  }
}

// 1. General API Rate Limiter: 500 requests per 15 minutes per IP
export const generalApiLimiter = new MemoryRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 500,
  message: 'API rate limit exceeded. Please throttle your requests.',
  keyGenerator: (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '') ||
      req.socket.remoteAddress ||
      '127.0.0.1';
    return `general:${ip}`;
  },
});

// 2. Strict Authentication Rate Limiter: 15 login / register / reset attempts per 15 minutes per IP
export const authRateLimiter = new MemoryRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 15,
  message: 'Too many authentication attempts. Please wait 15 minutes before trying again to protect against brute-force attacks.',
  keyGenerator: (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '') ||
      req.socket.remoteAddress ||
      '127.0.0.1';
    return `auth:${ip}`;
  },
});

// 3. Sensitive Financial Transactions Limiter: 60 payments/disbursements per 5 minutes per user/IP
export const financialRateLimiter = new MemoryRateLimiter({
  windowMs: 5 * 60 * 1000,
  maxRequests: 60,
  message: 'Transaction rate threshold reached. Please wait a moment before initiating another financial transaction.',
  keyGenerator: (req) => {
    const userId = req.user?.userId || 'anon';
    const forwarded = req.headers['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '') ||
      req.socket.remoteAddress ||
      '127.0.0.1';
    return `finance:${userId}:${ip}`;
  },
});
