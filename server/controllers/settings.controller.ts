import { Request, Response, NextFunction } from 'express';
import {
  getSystemSettings,
  updateSystemSettings,
  getWorkflowSettings,
  updateWorkflowSettings,
} from '../services/settings.service.js';
import { BulkUpdateSettingsInput } from '../../shared/validators/settings.js';
import { WorkflowSettingsDTO } from '../../shared/types/index.js';
import { AppError } from '../middleware/errorHandler.js';

export async function handleGetSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const settings = await getSystemSettings();
    res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleUpdateSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { settings } = req.body as BulkUpdateSettingsInput;
    const updated = await updateSystemSettings(settings, req.user.userId);
    res.status(200).json({
      success: true,
      data: updated,
      message: 'System configuration settings updated successfully',
    });
  } catch (error) {
    next(error);
  }
}

export async function handleGetWorkflowSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const settings = await getWorkflowSettings();
    res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleUpdateWorkflowSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();
    const settings = req.body as WorkflowSettingsDTO;
    const updated = await updateWorkflowSettings(req.user.userId, settings);
    res.status(200).json({
      success: true,
      data: updated,
      message: 'Workflow approval limits & permissions configured successfully',
    });
  } catch (error) {
    next(error);
  }
}
