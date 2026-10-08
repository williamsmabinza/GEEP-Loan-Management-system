import { Request, Response, NextFunction } from 'express';
import {
  getPortfolioReport,
  exportReportData,
  getDashboardSummary,
  getReportFilterOptions,
  generateReport,
  exportReport,
} from '../services/reports.service.js';
import { AppError } from '../middleware/errorHandler.js';
import { ReportFilterParams, ReportType } from '../../shared/types/index.js';

export async function handleGetDashboardSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();
    const branchId = req.query.branchId as string | undefined;
    const summary = await getDashboardSummary(req.user, branchId);
    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleGetPortfolioReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const report = await getPortfolioReport();
    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleGetReportFilterOptions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();
    const options = await getReportFilterOptions(req.user);
    res.status(200).json({
      success: true,
      data: options,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleGenerateReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();
    const rawReportType = (req.query.reportType as string) || req.body?.reportType || 'LOAN_PORTFOLIO';
    const filter: ReportFilterParams = {
      reportType: rawReportType as ReportType,
      startDate: (req.query.startDate as string) || req.body?.startDate,
      endDate: (req.query.endDate as string) || req.body?.endDate,
      branchId: (req.query.branchId as string) || req.body?.branchId,
      productId: (req.query.productId as string) || req.body?.productId,
      status: (req.query.status as string) || req.body?.status,
      customerId: (req.query.customerId as string) || req.body?.customerId,
      staffId: (req.query.staffId as string) || req.body?.staffId,
      search: (req.query.search as string) || req.body?.search,
      page: req.query.page ? parseInt(req.query.page as string, 10) : (req.body?.page || 1),
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : (req.body?.pageSize || 10),
      sortBy: (req.query.sortBy as string) || req.body?.sortBy,
      sortOrder: ((req.query.sortOrder as 'asc' | 'desc') || req.body?.sortOrder || 'asc'),
    };

    const reportData = await generateReport(filter, req.user);
    res.status(200).json({
      success: true,
      data: reportData,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleExportReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();
    
    // Check if this is a comprehensive report export or legacy export
    const rawReportType = (req.query.reportType as string) || req.body?.reportType;
    if (rawReportType) {
      const format = ((req.query.format as string) || req.body?.format || 'csv') as 'csv' | 'pdf' | 'html';
      const filter: ReportFilterParams = {
        reportType: rawReportType as ReportType,
        startDate: (req.query.startDate as string) || req.body?.startDate,
        endDate: (req.query.endDate as string) || req.body?.endDate,
        branchId: (req.query.branchId as string) || req.body?.branchId,
        productId: (req.query.productId as string) || req.body?.productId,
        status: (req.query.status as string) || req.body?.status,
        customerId: (req.query.customerId as string) || req.body?.customerId,
        staffId: (req.query.staffId as string) || req.body?.staffId,
        search: (req.query.search as string) || req.body?.search,
        sortBy: (req.query.sortBy as string) || req.body?.sortBy,
        sortOrder: ((req.query.sortOrder as 'asc' | 'desc') || req.body?.sortOrder || 'asc'),
      };

      const exportResult = await exportReport(filter, req.user, format);
      res.setHeader('Content-Type', exportResult.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
      res.status(200).json({
        success: true,
        data: exportResult,
        message: 'Report exported successfully',
      });
      return;
    }

    // Fallback legacy export
    const legacyType = (req.query.type as string) || 'loans';
    const exportResult = await exportReportData(legacyType, req.user.userId);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
    res.status(200).json({
      success: true,
      data: exportResult,
      message: 'Report generated for export',
    });
  } catch (error) {
    next(error);
  }
}
