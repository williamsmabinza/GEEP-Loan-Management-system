import { Request, Response, NextFunction } from 'express';
import { getAuditLogs } from '../services/audit.service.js';

export async function handleGetAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
    const logs = await getAuditLogs(limit);

    res.status(200).json({
      success: true,
      data: logs,
    });
  } catch (error) {
    next(error);
  }
}
