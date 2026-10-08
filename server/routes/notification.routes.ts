import { Router } from 'express';
import {
  handleGetNotifications,
  handleMarkAsRead,
  handleMarkAllAsRead,
  handleDeleteNotification,
  handleGetNotificationSettings,
  handleUpdateNotificationRule,
  handleUpdateNotificationTemplate,
  handleUpdateSmsConfig,
  handleUpdateEmailConfig,
  handleUpdateGlobalChannels,
  handleTestDispatch,
  handleScanAlerts,
} from '../controllers/notification.controller.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

// User notification feed & mutations
router.get('/', handleGetNotifications);
router.put('/read-all', handleMarkAllAsRead);
router.put('/:id/read', handleMarkAsRead);
router.delete('/:id', handleDeleteNotification);

// Administrative configuration & provider management
router.get('/settings', requirePermission('settings.view'), handleGetNotificationSettings);
router.put('/rules/:eventType', requirePermission('settings.update'), handleUpdateNotificationRule);
router.put('/templates/:id', requirePermission('settings.update'), handleUpdateNotificationTemplate);
router.put('/providers/sms', requirePermission('settings.update'), handleUpdateSmsConfig);
router.put('/providers/email', requirePermission('settings.update'), handleUpdateEmailConfig);
router.put('/channels/global', requirePermission('settings.update'), handleUpdateGlobalChannels);
router.post('/test-dispatch', requirePermission('settings.update'), handleTestDispatch);
router.post('/scan-alerts', requirePermission('settings.update'), handleScanAlerts);

export default router;
