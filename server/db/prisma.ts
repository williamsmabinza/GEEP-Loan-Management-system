import { PrismaClient } from '@prisma/client';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { DatabaseHealthInfo } from '../../shared/types/index.js';

// Guarantee valid DATABASE_URL exists in process.env
const dbUrl =
  process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('mysql://')
    ? process.env.DATABASE_URL
    : config.databaseUrl && config.databaseUrl.startsWith('mysql://')
    ? config.databaseUrl
    : 'mysql://nexa_admin:NexaSecurePass2026!@localhost:3306/nexa_lms';

process.env.DATABASE_URL = dbUrl;

// Global declaration for singleton Prisma in development
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: dbUrl,
      },
    },
    log:
      config.env === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'stdout', level: 'error' },
            { emit: 'stdout', level: 'warn' },
          ]
        : ['error'],
  });

if (config.env !== 'production') {
  globalForPrisma.prisma = prisma;
}

let dbConnected = false;
let lastCheckTime = 0;
const CHECK_INTERVAL_MS = 15000;

export async function isDatabaseConnected(): Promise<boolean> {
  const now = Date.now();
  if (now - lastCheckTime < CHECK_INTERVAL_MS) {
    return dbConnected;
  }

  lastCheckTime = now;
  try {
    // Perform simple raw query to verify MySQL connection
    await prisma.$queryRaw`SELECT 1`;
    dbConnected = true;
    return true;
  } catch (error) {
    dbConnected = false;
    logger.debug(`MySQL connection check returned offline: ${(error as Error).message}`);
    return false;
  }
}

export async function getDatabaseHealth(): Promise<DatabaseHealthInfo> {
  const start = performance.now();
  const connected = await isDatabaseConnected();
  const latencyMs = Math.round(performance.now() - start);

  return {
    status: connected ? 'connected' : 'disconnected',
    engine: 'MySQL',
    host: config.dbHost,
    port: config.dbPort,
    database: config.dbName,
    connectionPoolActive: connected,
    latencyMs: connected ? latencyMs : 0,
  };
}

// Graceful shutdown hook
export async function disconnectPrisma(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info('Prisma disconnected gracefully');
  } catch (err) {
    logger.error('Error disconnecting Prisma:', err);
  }
}
