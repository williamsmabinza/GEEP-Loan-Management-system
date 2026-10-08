import { Router } from 'express';
import {
  handleGetPortfolioReport,
  handleExportReport,
  handleGetDashboardSummary,
  handleGetReportFilterOptions,
  handleGenerateReport,
} from '../controllers/reports.controller.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/dashboard', requirePermission('loan.view'), handleGetDashboardSummary);
router.get('/portfolio', requirePermission('report.view'), handleGetPortfolioReport);
router.get('/filter-options', requirePermission('report.view'), handleGetReportFilterOptions);
router.get('/query', requirePermission('report.view'), handleGenerateReport);
router.post('/query', requirePermission('report.view'), handleGenerateReport);
router.get('/export', requirePermission('report.export'), handleExportReport);
router.post('/export', requirePermission('report.export'), handleExportReport);

export default router;
