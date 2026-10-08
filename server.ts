import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRouter from './server/routes/index.js';
import { errorHandler } from './server/middleware/errorHandler.js';
import { securityHeaders, verifyRequestOrigin } from './server/middleware/securityHeaders.js';
import { generalApiLimiter } from './server/middleware/rateLimiter.js';
import { logger } from './server/utils/logger.js';
import { config } from './server/config/index.js';
import { disconnectPrisma } from './server/db/prisma.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();

  // Disable x-powered-by header to prevent fingerprinting
  app.disable('x-powered-by');

  // HTTP Security Headers (CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy)
  app.use(securityHeaders);

  // Strict CORS policy
  app.use(
    cors({
      origin: config.security.corsOrigin === '*' ? '*' : config.security.corsOrigin.split(',').map((o) => o.trim()),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    })
  );
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // HTTP Request Logging Middleware
  app.use((req, res, next) => {
    const start = performance.now();
    res.on('finish', () => {
      const duration = performance.now() - start;
      if (!req.url.startsWith('/@') && !req.url.includes('.vite')) {
        logger.http(req.method, req.originalUrl, res.statusCode, duration);
      }
    });
    next();
  });

  // State-mutation Origin Verification & General API Rate Limiting
  app.use('/api', verifyRequestOrigin);
  app.use('/api', generalApiLimiter.middleware());

  // Mount REST API
  app.use('/api', apiRouter);

  // Frontend integration: Vite middleware in development, static files in production
  if (config.env !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    logger.info('Vite development middleware mounted (HMR disabled for iframe stability)');
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    // Block direct access to the compiled backend bundle
    app.get('/server.js', (_req, res) => {
      res.status(404).send('Not Found');
    });
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
    logger.info(`Serving production static bundle from ${distPath}`);
  }

  // Global Error Handler Middleware
  app.use(errorHandler);

  const server = app.listen(config.port, '0.0.0.0', () => {
    logger.info(`🚀 Nexa Loan Management System server listening on port ${config.port} [${config.env}]`);
    logger.info(`📡 API Endpoints base: http://0.0.0.0:${config.port}/api`);
    logger.info(`🔒 Relational Database Target: ${config.dbHost}:${config.dbPort}/${config.dbName} (MySQL)`);
  });

  // Graceful termination handling
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down server gracefully...`);
    server.close(async () => {
      await disconnectPrisma();
      logger.info('Process terminated cleanly');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

startServer().catch((err) => {
  logger.error('Failed to initialize server:', err);
  process.exit(1);
});
