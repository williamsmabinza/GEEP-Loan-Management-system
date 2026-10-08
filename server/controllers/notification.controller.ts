import { Request, Response, NextFunction } from 'express';
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  getNotificationSettings,
  updateNotificationRule,
  updateNotificationTemplate,
  updateSmsProviderConfig,
  updateEmailProviderConfig,
  updateGlobalChannels,
  testDispatchNotification,
  scanAndDispatchAlerts,
} from '../services/notification.service.js';
import { AppError } from '../middleware/errorHandler.js';
import { NotificationEventType, NotificationChannelType } from '../../shared/types/index.js';

export async function handleGetNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();

    const channel = req.query.channel as NotificationChannelType | undefined;
    const unreadOnly = req.query.unreadOnly === 'true';
    const search = req.query.search as string | undefined;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 20;

    const result = await getUserNotifications(req.user.userId, {
      channel,
      unreadOnly,
      search,
      page,
      pageSize,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleMarkAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { id } = req.params;

    await markNotificationAsRead(id, req.user.userId);
    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error) {
    next(error);
  }
}

export async function handleMarkAllAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();

    const count = await markAllNotificationsAsRead(req.user.userId);
    res.status(200).json({
      success: true,
      data: { count },
      message: `${count} notifications marked as read`,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleDeleteNotification(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { id } = req.params;

    await deleteNotification(id, req.user.userId);
    res.status(200).json({
      success: true,
      message: 'Notification removed',
    });
  } catch (error) {
    next(error);
  }
}

export async function handleGetNotificationSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();

    const settings = await getNotificationSettings();
    res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleUpdateNotificationRule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { eventType } = req.params;

    const updated = await updateNotificationRule(
      eventType as NotificationEventType,
      req.body,
      req.user.userId
    );

    res.status(200).json({
      success: true,
      data: updated,
      message: `Notification rule for ${eventType} updated`,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleUpdateNotificationTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { id } = req.params;

    const updated = await updateNotificationTemplate(id, req.body, req.user.userId);
    res.status(200).json({
      success: true,
      data: updated,
      message: 'Notification template updated',
    });
  } catch (error) {
    next(error);
  }
}

export async function handleUpdateSmsConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();

    const updated = await updateSmsProviderConfig(req.body, req.user.userId);
    res.status(200).json({
      success: true,
      data: updated,
      message: 'SMS provider gateway configuration updated',
    });
  } catch (error) {
    next(error);
  }
}

export async function handleUpdateEmailConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();

    const updated = await updateEmailProviderConfig(req.body, req.user.userId);
    res.status(200).json({
      success: true,
      data: updated,
      message: 'Email gateway configuration updated',
    });
  } catch (error) {
    next(error);
  }
}

export async function handleUpdateGlobalChannels(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();

    const updated = await updateGlobalChannels(req.body, req.user.userId);
    res.status(200).json({
      success: true,
      data: updated,
      message: 'Global notification channels updated',
    });
  } catch (error) {
    next(error);
  }
}

export async function handleTestDispatch(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { eventType, channel, recipient } = req.body;

    const result = await testDispatchNotification(
      eventType,
      channel,
      recipient || {},
      req.user.userId
    );

    res.status(200).json({
      success: true,
      data: result,
      message: `Test notification sent via ${channel}`,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleScanAlerts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();

    const summary = await scanAndDispatchAlerts(req.user.userId);
    res.status(200).json({
      success: true,
      data: summary,
      message: `Scanned portfolio: ${summary.upcomingCount} upcoming and ${summary.overdueCount} overdue reminders processed`,
    });
  } catch (error) {
    next(error);
  }
}
