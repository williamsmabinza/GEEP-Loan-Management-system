import { Router } from 'express';
import authRoutes from './auth.routes.js';
import usersRoutes from './users.routes.js';
import customersRoutes from './customers.routes.js';
import loansRoutes from './loans.routes.js';
import paymentsRoutes from './payments.routes.js';
import productsRoutes from './products.routes.js';
import applicationsRoutes from './applications.routes.js';
import reportsRoutes from './reports.routes.js';
import settingsRoutes from './settings.routes.js';
import notificationRoutes from './notification.routes.js';
import auditRoutes from './audit.routes.js';
import healthRoutes from './health.routes.js';

const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/users', usersRoutes);
apiRouter.use('/customers', customersRoutes);
apiRouter.use('/loans', loansRoutes);
apiRouter.use('/applications', applicationsRoutes);
apiRouter.use('/payments', paymentsRoutes);
apiRouter.use('/products', productsRoutes);
apiRouter.use('/reports', reportsRoutes);
apiRouter.use('/settings', settingsRoutes);
apiRouter.use('/notifications', notificationRoutes);
apiRouter.use('/audit-logs', auditRoutes);
apiRouter.use('/health', healthRoutes);

export default apiRouter;

