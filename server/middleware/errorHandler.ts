import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError(400, 'BAD_REQUEST', message, details);
  }

  static unauthorized(message = 'Authentication required to access this resource') {
    return new AppError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'You do not have permission to perform this action') {
    return new AppError(403, 'FORBIDDEN', message);
  }

  static notFound(resource = 'Resource') {
    return new AppError(404, 'NOT_FOUND', `${resource} not found`);
  }

  static conflict(message: string) {
    return new AppError(409, 'CONFLICT', message);
  }

  static unprocessable(message: string, details?: unknown) {
    return new AppError(422, 'UNPROCESSABLE_ENTITY', message, details);
  }

  static internal(message = 'An unexpected server error occurred') {
    return new AppError(500, 'INTERNAL_SERVER_ERROR', message);
  }
}

/**
 * Sanitizes messages to prevent accidental leakage of database credentials,
 * passwords, JWT tokens, hashes, or connection strings.
 */
export function sanitizeSecurityLeaks(text: string): string {
  if (!text || typeof text !== 'string') return text;

  return text
    // Redact database connection URLs: mysql://user:password@host:port/db
    .replace(/(mysql|postgresql|postgres|mongodb|redis):\/\/[^:\s]+:[^@\s]+@[^\s/]+/gi, '$1://[REDACTED_USER]:[REDACTED_PASSWORD]@[REDACTED_HOST]')
    // Redact bcrypt hashes
    .replace(/\$2[aby]\$\d+\$[./A-Za-z0-9]{53}/g, '[REDACTED_HASH]')
    // Redact JWT tokens
    .replace(/ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '[REDACTED_JWT]')
    // Redact bearer tokens
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]')
    // Redact password assignment in queries or JSON: "password": "..."
    .replace(/("password"|"oldPassword"|"newPassword"|"secret")\s*:\s*"[^"]+"/gi, '$1: "[REDACTED]"');
}

export function errorHandler(
  err: Error | AppError | ZodError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  const timestamp = new Date().toISOString();

  // 1. Handled AppError
  if (err instanceof AppError) {
    const cleanMessage = sanitizeSecurityLeaks(err.message);
    logger.warn(`Handled application error: [${err.code}] ${cleanMessage}`, {
      path: req.originalUrl,
      method: req.method,
      statusCode: err.statusCode,
      details: err.details,
    });

    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: cleanMessage,
        details: err.details,
      },
      timestamp,
    });
    return;
  }

  // 2. Zod Validation Error
  if (err instanceof ZodError) {
    const formattedErrors = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
      rule: issue.code,
    }));

    logger.warn(`Validation failure on ${req.method} ${req.originalUrl}`, {
      errors: formattedErrors,
    });

    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request payload validation failed',
        details: formattedErrors,
      },
      timestamp,
    });
    return;
  }

  // 3. Body parser JSON Syntax Error (prevent server crash on malformed JSON payload)
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      success: false,
      error: {
        code: 'MALFORMED_JSON',
        message: 'The request body could not be parsed as valid JSON.',
      },
      timestamp,
    });
    return;
  }

  // 4. Prisma Known Request Errors
  const prismaErr = err as { code?: string; meta?: { target?: string[] } };
  if (prismaErr.code === 'P2002') {
    const target = prismaErr.meta?.target ? prismaErr.meta.target.join(', ') : 'field';
    res.status(409).json({
      success: false,
      error: {
        code: 'UNIQUE_CONSTRAINT_VIOLATION',
        message: `A record with this ${target} already exists.`,
      },
      timestamp,
    });
    return;
  }

  if (prismaErr.code === 'P2025') {
    res.status(404).json({
      success: false,
      error: {
        code: 'RECORD_NOT_FOUND',
        message: 'The requested database record does not exist.',
      },
      timestamp,
    });
    return;
  }

  // 5. JWT errors
  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Supplied authentication token is malformed or invalid.',
      },
      timestamp,
    });
    return;
  }

  if (err.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      error: {
        code: 'TOKEN_EXPIRED',
        message: 'Authentication session has expired. Please log in again.',
      },
      timestamp,
    });
    return;
  }

  // 6. Unhandled Internal Errors
  const cleanErrMsg = sanitizeSecurityLeaks(err.message || 'Unknown internal error');
  logger.error(`Unhandled error on ${req.method} ${req.originalUrl}: ${cleanErrMsg}`, err);

  const isProd = process.env.NODE_ENV === 'production';
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: isProd ? 'Internal server error occurred' : cleanErrMsg,
      ...(isProd ? {} : { stack: sanitizeSecurityLeaks(err.stack || '') }),
    },
    timestamp,
  });
}
