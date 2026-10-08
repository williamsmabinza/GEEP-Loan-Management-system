import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { AuditAction } from '../../shared/types/index.js';
import { recordAuditLog } from '../services/audit.service.js';

export function auditRequest(action: AuditAction, resource: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Run after response finishes to capture outcome
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        const userId = req.user?.userId || null;
        const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
        const userAgent = req.headers['user-agent'] || 'Unknown';
        const resourceId = req.params?.id || req.body?.id || null;

        recordAuditLog({
          userId,
          action,
          resource,
          resourceId,
          ipAddress,
          userAgent,
          details: {
            method: req.method,
            path: req.originalUrl,
            statusCode: res.statusCode,
          },
        }).catch((err) => {
          logger.warn(`Failed to commit audit record: ${(err as Error).message}`);
        });
      }
    });

    next();
  };
}
