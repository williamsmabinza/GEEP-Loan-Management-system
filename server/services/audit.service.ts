import { AuditAction, AuditLogDTO } from '../../shared/types/index.js';
import { prisma, isDatabaseConnected } from '../db/prisma.js';
import { logger } from '../utils/logger.js';

export interface CreateAuditLogParams {
  userId?: string | null;
  action: AuditAction;
  resource: string;
  resourceId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  details?: Record<string, unknown> | null;
}

// In-memory buffer for fallback when MySQL is initializing or offline in dev
const memoryAuditLogs: AuditLogDTO[] = [
  {
    id: 'audit-001',
    userId: 'user-admin-01',
    userEmail: 'admin@nexa.financial',
    userFullName: 'Sarah Sterling',
    action: 'USER_LOGIN',
    resource: 'AUTH',
    resourceId: 'user-admin-01',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    details: { reason: 'System initialization and compliance checks' },
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'audit-002',
    userId: 'user-cust-01',
    userEmail: 'customer@nexa.financial',
    userFullName: 'Alexander Hayes',
    action: 'LOAN_APPLICATION_CREATED',
    resource: 'LOAN',
    resourceId: 'loan-sme-0042',
    ipAddress: '72.14.201.88',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    details: { amount: 100000, product: 'Commercial Working Capital' },
    timestamp: new Date(Date.now() - 3600000).toISOString(),
  },
];

export async function recordAuditLog(params: CreateAuditLogParams): Promise<void> {
  const isConnected = await isDatabaseConnected();
  logger.audit(params.action, params.userId || 'ANONYMOUS', params.details);

  if (isConnected) {
    try {
      await prisma.auditLog.create({
        data: {
          userId: params.userId || null,
          action: params.action,
          entity: params.resource,
          entityId: params.resourceId || null,
          ipAddress: params.ipAddress || null,
          userAgent: params.userAgent || null,
          newValuesJson: params.details ? JSON.stringify(params.details) : null,
        },
      });
      return;
    } catch (err) {
      logger.warn(`Could not persist audit record to MySQL: ${(err as Error).message}`);
    }
  }

  // Fallback to memory audit buffer
  memoryAuditLogs.unshift({
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    userId: params.userId || null,
    userEmail: params.userId ? 'authenticated_user' : null,
    userFullName: params.userId ? 'Staff/Customer' : null,
    action: params.action,
    resource: params.resource,
    resourceId: params.resourceId || null,
    ipAddress: params.ipAddress || '127.0.0.1',
    userAgent: params.userAgent || 'App Client',
    details: params.details || null,
    timestamp: new Date().toISOString(),
  });
}

export async function getAuditLogs(limit = 50): Promise<AuditLogDTO[]> {
  const isConnected = await isDatabaseConnected();

  if (isConnected) {
    try {
      const records = await prisma.auditLog.findMany({
        take: limit,
        orderBy: { timestamp: 'desc' },
        include: {
          user: {
            select: {
              email: true,
            },
          },
        },
      });

      return records.map((r) => ({
        id: r.id,
        userId: r.userId,
        userEmail: r.user?.email || null,
        userFullName: r.user?.email || null,
        action: r.action,
        resource: r.entity,
        resourceId: r.entityId,
        ipAddress: r.ipAddress,
        userAgent: r.userAgent,
        details: r.newValuesJson ? JSON.parse(r.newValuesJson) : null,
        timestamp: r.timestamp.toISOString(),
      }));
    } catch (err) {
      logger.warn(`Error querying audit logs from MySQL: ${(err as Error).message}`);
    }
  }

  return memoryAuditLogs.slice(0, limit);
}
