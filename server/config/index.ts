import dotenv from 'dotenv';
dotenv.config();

export interface ServerConfig {
  env: 'development' | 'test' | 'production';
  port: number;
  appUrl: string;
  apiUrl: string;
  clientUrl: string;
  databaseUrl: string;
  dbHost: string;
  dbPort: number;
  dbUser: string;
  dbName: string;
  jwt: {
    secret: string;
    expiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  security: {
    bcryptSaltRounds: number;
    corsOrigin: string;
  };
  logging: {
    level: string;
    auditLogEnabled: boolean;
  };
}

function parseDatabaseUrl(urlStr: string) {
  try {
    const parsed = new URL(urlStr);
    return {
      host: parsed.hostname || 'localhost',
      port: parsed.port ? parseInt(parsed.port, 10) : 3306,
      user: parsed.username || 'nexa_admin',
      database: parsed.pathname ? parsed.pathname.replace(/^\//, '') : 'nexa_lms',
    };
  } catch {
    return { host: 'localhost', port: 3306, user: 'nexa_admin', database: 'nexa_lms' };
  }
}

const rawDatabaseUrl =
  process.env.DATABASE_URL || 'mysql://nexa_admin:NexaSecurePass2026!@localhost:3306/nexa_lms';
const parsedDb = parseDatabaseUrl(rawDatabaseUrl);

const resolvedAppUrl = process.env.APP_URL || process.env.CLIENT_URL || 'http://localhost:3000';
const resolvedClientUrl = process.env.CLIENT_URL || process.env.APP_URL || 'http://localhost:3000';
const resolvedApiUrl = process.env.API_URL || `${resolvedAppUrl}/api`;

export const config: ServerConfig = {
  env: (process.env.NODE_ENV as 'development' | 'test' | 'production') || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  appUrl: resolvedAppUrl,
  apiUrl: resolvedApiUrl,
  clientUrl: resolvedClientUrl,
  databaseUrl: rawDatabaseUrl,
  dbHost: process.env.DB_HOST || parsedDb.host,
  dbPort: parseInt(process.env.DB_PORT || String(parsedDb.port), 10),
  dbUser: process.env.DB_USER || parsedDb.user,
  dbName: process.env.DB_NAME || parsedDb.database,
  jwt: {
    secret: process.env.JWT_SECRET || 'nexa_lms_super_secure_jwt_secret_dev_key_2026_finance',
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'nexa_lms_refresh_token_secret_dev_key_2026_finance',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  security: {
    bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10),
    corsOrigin: process.env.CORS_ORIGIN || process.env.CLIENT_URL || 'http://localhost:3000',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    auditLogEnabled: process.env.AUDIT_LOG_ENABLED !== 'false',
  },
};
