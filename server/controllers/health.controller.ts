import { Request, Response } from 'express';
import { getDatabaseHealth } from '../db/prisma.js';
import { SystemHealthDTO } from '../../shared/types/index.js';
import { config } from '../config/index.js';

const serverStartTime = Date.now();

export async function handleHealthCheck(req: Request, res: Response): Promise<void> {
  const dbHealth = await getDatabaseHealth();
  const uptimeSeconds = Math.floor((Date.now() - serverStartTime) / 1000);

  const payload: SystemHealthDTO = {
    status: dbHealth.status === 'connected' ? 'healthy' : 'degraded',
    uptimeSeconds,
    timestamp: new Date().toISOString(),
    version: '1.0.0-enterprise',
    environment: config.env,
    database: dbHealth,
    features: {
      jwtAuth: true,
      rbac: true,
      auditLog: config.logging.auditLogEnabled,
      zodValidation: true,
      prismaOrm: true,
      relationalEntitiesCount: 21,
    },
  };

  res.status(200).json({
    success: true,
    data: payload,
  });
}
