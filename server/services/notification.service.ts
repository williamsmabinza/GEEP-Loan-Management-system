import { prisma, isDatabaseConnected } from '../db/prisma.js';
import { recordAuditLog } from './audit.service.js';
import { logger } from '../utils/logger.js';
import {
  NotificationDTO,
  NotificationEventType,
  NotificationChannelType,
  NotificationTypeRuleDTO,
  NotificationTemplateDTO,
  SmsProviderConfigDTO,
  EmailProviderConfigDTO,
  NotificationSystemSettingsDTO,
  SendNotificationPayload,
  UserRole,
} from '../../shared/types/index.js';
import {
  DEFAULT_NOTIFICATION_RULES,
  DEFAULT_NOTIFICATION_TEMPLATES,
  renderTemplate,
} from './notifications/templates.js';
import { getSmsProvider } from './notifications/providers/sms.provider.js';
import { getEmailProvider } from './notifications/providers/email.provider.js';

// ----------------------------------------------------------------------------
// In-Memory Fallback State (Synchronized with DB when available)
// ----------------------------------------------------------------------------

let activeRules: NotificationTypeRuleDTO[] = JSON.parse(JSON.stringify(DEFAULT_NOTIFICATION_RULES));
let activeTemplates: NotificationTemplateDTO[] = JSON.parse(JSON.stringify(DEFAULT_NOTIFICATION_TEMPLATES));

let activeSmsConfig: SmsProviderConfigDTO = {
  providerId: 'SANDBOX',
  providerName: 'Simulated Sandbox Gateway (Safe Mode)',
  senderId: 'NEXA-BANK',
  isConfigured: true,
  sandboxMode: true,
};

let activeEmailConfig: EmailProviderConfigDTO = {
  providerId: 'SANDBOX',
  providerName: 'Simulated Sandbox Email Gateway',
  fromEmail: 'notifications@nexa.financial',
  fromName: 'Nexa Microfinance Banking',
  isConfigured: true,
  sandboxMode: true,
};

let globalChannels = {
  inApp: true,
  email: true,
  sms: true,
};

// Seed initial in-memory notifications for live demo experience
const memoryNotifications: NotificationDTO[] = [
  {
    id: 'notif-demo-01',
    userId: 'user-cust-01',
    userName: 'Alexander Hayes',
    customerId: 'cust-alex-01',
    customerName: 'Alexander Hayes',
    eventType: 'LOAN_APPLICATION_SUBMITTED',
    channel: 'IN_APP',
    subject: 'Loan Application Submitted: APP-2026-0042',
    message: 'Your application for TZS 10,000,000 (Commercial Working Capital) was received successfully and is under appraisal review.',
    status: 'READ',
    sentAt: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
    readAt: new Date(Date.now() - 3600 * 1000 * 20).toISOString(),
    createdAt: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
  },
  {
    id: 'notif-demo-02',
    userId: 'user-cust-01',
    userName: 'Alexander Hayes',
    customerId: 'cust-alex-01',
    eventType: 'APPLICATION_APPROVED',
    channel: 'IN_APP',
    subject: 'Credit Facility Approved: APP-2026-0042',
    message: 'Congratulations! Application #APP-2026-0042 has been approved for TZS 10,000,000 at 12.00% APR.',
    status: 'READ',
    sentAt: new Date(Date.now() - 3600 * 1000 * 12).toISOString(),
    readAt: new Date(Date.now() - 3600 * 1000 * 8).toISOString(),
    createdAt: new Date(Date.now() - 3600 * 1000 * 12).toISOString(),
  },
  {
    id: 'notif-demo-03',
    userId: 'user-cust-01',
    userName: 'Alexander Hayes',
    customerId: 'cust-alex-01',
    eventType: 'LOAN_DISBURSED',
    channel: 'IN_APP',
    subject: 'Capital Disbursed: Facility LN-2026-6878',
    message: 'TZS 10,000,000 has been disbursed via BANK_TRANSFER (Ref: TXN-DSB-7819). Your first installment is due next month.',
    status: 'SENT',
    sentAt: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
    readAt: null,
    createdAt: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
  },
  {
    id: 'notif-demo-04',
    userId: 'user-admin-01',
    userName: 'Sarah Mwamburi',
    customerId: 'cust-alex-01',
    customerName: 'Alexander Hayes',
    eventType: 'LOAN_APPLICATION_SUBMITTED',
    channel: 'IN_APP',
    subject: 'New Application Submitted: APP-2026-0042',
    message: 'Borrower Alexander Hayes submitted application APP-2026-0042 for TZS 10,000,000 requiring committee review.',
    status: 'SENT',
    sentAt: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
    readAt: null,
    createdAt: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
  },
  {
    id: 'notif-demo-05',
    userId: 'user-admin-01',
    userName: 'Sarah Mwamburi',
    customerId: 'cust-alex-01',
    customerName: 'Alexander Hayes',
    eventType: 'PAYMENT_RECEIVED',
    channel: 'IN_APP',
    subject: 'Payment Received: Receipt #RCP-2026-96159',
    message: 'Received TZS 1,170,000 for loan LN-TEST-full-01 via BANK_TRANSFER. Reconciled to ledger.',
    status: 'SENT',
    sentAt: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
    readAt: null,
    createdAt: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
  },
];

// ----------------------------------------------------------------------------
// Core Notification Queries & Mutations
// ----------------------------------------------------------------------------

export async function getUserNotifications(
  userId: string,
  filter?: {
    channel?: NotificationChannelType;
    unreadOnly?: boolean;
    search?: string;
    page?: number;
    pageSize?: number;
  }
): Promise<{ notifications: NotificationDTO[]; total: number; unreadCount: number }> {
  const isConnected = await isDatabaseConnected();

  if (isConnected) {
    try {
      const where: any = { userId };
      if (filter?.channel) where.channel = filter.channel;
      if (filter?.unreadOnly) where.readAt = null;

      const [dbNotifications, total, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: filter?.page ? (filter.page - 1) * (filter.pageSize || 10) : 0,
          take: filter?.pageSize || 20,
          include: {
            user: {
              select: {
                email: true,
                staffProfile: { select: { firstName: true, lastName: true } },
                customer: { select: { firstName: true, lastName: true } },
              },
            },
            customer: { select: { firstName: true, lastName: true } },
          },
        }),
        prisma.notification.count({ where }),
        prisma.notification.count({ where: { userId, readAt: null } }),
      ]);

      const formatted: NotificationDTO[] = dbNotifications.map((n: any) => {
        const staff = n.user?.staffProfile;
        const cust = n.user?.customer;
        const userName = staff
          ? `${staff.firstName} ${staff.lastName}`.trim()
          : (cust ? `${cust.firstName} ${cust.lastName}`.trim() : n.user?.email || 'User');
        const customerName = n.customer ? `${n.customer.firstName} ${n.customer.lastName}`.trim() : null;

        return {
          id: n.id,
          userId: n.userId,
          userName,
          customerId: n.customerId,
          customerName,
          eventType: 'LOAN_APPLICATION_SUBMITTED' as NotificationEventType,
          channel: n.channel as NotificationChannelType,
          subject: n.subject,
          message: n.message,
          status: (n.readAt ? 'READ' : n.status) as any,
          readAt: n.readAt ? n.readAt.toISOString() : null,
          sentAt: n.sentAt.toISOString(),
          createdAt: n.createdAt.toISOString(),
        };
      });

      return { notifications: formatted, total, unreadCount };
    } catch (err) {
      logger.error('Error fetching notifications from DB:', err);
    }
  }

  // Memory fallback
  let items = memoryNotifications.filter((n) => n.userId === userId || n.userId === 'user-admin-01' || userId === 'user-admin-01');

  if (filter?.channel) {
    items = items.filter((n) => n.channel === filter.channel);
  }
  if (filter?.unreadOnly) {
    items = items.filter((n) => !n.readAt);
  }
  if (filter?.search) {
    const q = filter.search.toLowerCase();
    items = items.filter((n) => n.subject.toLowerCase().includes(q) || n.message.toLowerCase().includes(q));
  }

  const unreadCount = memoryNotifications.filter((n) => (n.userId === userId || userId === 'user-admin-01') && !n.readAt).length;
  const total = items.length;

  const page = filter?.page || 1;
  const pageSize = filter?.pageSize || 20;
  const paged = items.slice((page - 1) * pageSize, page * pageSize);

  return { notifications: paged, total, unreadCount };
}

export async function markNotificationAsRead(notificationId: string, userId: string): Promise<boolean> {
  const isConnected = await isDatabaseConnected();
  const now = new Date();

  if (isConnected) {
    try {
      await prisma.notification.updateMany({
        where: { id: notificationId, userId },
        data: { readAt: now },
      });
    } catch (err) {
      logger.error('Error updating notification in DB:', err);
    }
  }

  const mem = memoryNotifications.find((n) => n.id === notificationId);
  if (mem) {
    mem.readAt = now.toISOString();
    mem.status = 'READ';
  }

  return true;
}

export async function markAllNotificationsAsRead(userId: string): Promise<number> {
  const isConnected = await isDatabaseConnected();
  const now = new Date();

  if (isConnected) {
    try {
      const res = await prisma.notification.updateMany({
        where: { userId, readAt: null },
        data: { readAt: now },
      });
      return res.count;
    } catch (err) {
      logger.error('Error marking all notifications in DB:', err);
    }
  }

  let count = 0;
  memoryNotifications.forEach((n) => {
    if ((n.userId === userId || userId === 'user-admin-01') && !n.readAt) {
      n.readAt = now.toISOString();
      n.status = 'READ';
      count++;
    }
  });

  return count;
}

export async function deleteNotification(notificationId: string, userId: string): Promise<boolean> {
  const isConnected = await isDatabaseConnected();

  if (isConnected) {
    try {
      await prisma.notification.deleteMany({
        where: { id: notificationId, userId },
      });
    } catch (err) {
      logger.error('Error deleting notification from DB:', err);
    }
  }

  const index = memoryNotifications.findIndex((n) => n.id === notificationId);
  if (index !== -1) {
    memoryNotifications.splice(index, 1);
  }

  return true;
}

// ----------------------------------------------------------------------------
// Settings, Rules & Provider Configuration Management
// ----------------------------------------------------------------------------

export async function getNotificationSettings(): Promise<NotificationSystemSettingsDTO> {
  return {
    rules: activeRules,
    templates: activeTemplates,
    smsProvider: activeSmsConfig,
    emailProvider: activeEmailConfig,
    channelsGlobalEnabled: globalChannels,
  };
}

export async function updateNotificationRule(
  eventType: NotificationEventType,
  updates: Partial<NotificationTypeRuleDTO>,
  actorUserId: string
): Promise<NotificationTypeRuleDTO> {
  const rule = activeRules.find((r) => r.eventType === eventType);
  if (!rule) {
    throw new Error(`Notification rule for event ${eventType} not found`);
  }

  if (updates.enabled !== undefined) rule.enabled = updates.enabled;
  if (updates.channels) {
    rule.channels = { ...rule.channels, ...updates.channels };
  }
  if (updates.rolesNotified) {
    rule.rolesNotified = updates.rolesNotified;
  }

  await recordAuditLog({
    userId: actorUserId,
    action: 'NOTIFICATION_RULE_UPDATED',
    resource: 'NotificationSetting',
    details: { eventType, updates },
  });

  return rule;
}

export async function updateNotificationTemplate(
  templateId: string,
  updates: { subjectTemplate?: string; bodyTemplate?: string; enabled?: boolean },
  actorUserId: string
): Promise<NotificationTemplateDTO> {
  const template = activeTemplates.find((t) => t.id === templateId);
  if (!template) {
    throw new Error(`Notification template ${templateId} not found`);
  }

  if (updates.subjectTemplate !== undefined) template.subjectTemplate = updates.subjectTemplate;
  if (updates.bodyTemplate !== undefined) template.bodyTemplate = updates.bodyTemplate;
  if (updates.enabled !== undefined) template.enabled = updates.enabled;

  await recordAuditLog({
    userId: actorUserId,
    action: 'NOTIFICATION_TEMPLATE_UPDATED',
    resource: 'NotificationSetting',
    details: { templateId, updates },
  });

  return template;
}

export async function updateSmsProviderConfig(
  config: Partial<SmsProviderConfigDTO>,
  actorUserId: string
): Promise<SmsProviderConfigDTO> {
  activeSmsConfig = {
    ...activeSmsConfig,
    ...config,
    isConfigured: Boolean(config.apiKey && config.apiSecret) || config.providerId === 'SANDBOX',
  };

  await recordAuditLog({
    userId: actorUserId,
    action: 'SMS_PROVIDER_CONFIG_UPDATED',
    resource: 'NotificationSetting',
    details: { providerId: activeSmsConfig.providerId, senderId: activeSmsConfig.senderId, sandbox: activeSmsConfig.sandboxMode },
  });

  return activeSmsConfig;
}

export async function updateEmailProviderConfig(
  config: Partial<EmailProviderConfigDTO>,
  actorUserId: string
): Promise<EmailProviderConfigDTO> {
  activeEmailConfig = {
    ...activeEmailConfig,
    ...config,
    isConfigured: Boolean(config.apiKey || config.host) || config.providerId === 'SANDBOX',
  };

  await recordAuditLog({
    userId: actorUserId,
    action: 'EMAIL_PROVIDER_CONFIG_UPDATED',
    resource: 'NotificationSetting',
    details: { providerId: activeEmailConfig.providerId, fromEmail: activeEmailConfig.fromEmail, sandbox: activeEmailConfig.sandboxMode },
  });

  return activeEmailConfig;
}

export async function updateGlobalChannels(
  channels: { inApp?: boolean; email?: boolean; sms?: boolean },
  actorUserId: string
): Promise<typeof globalChannels> {
  globalChannels = { ...globalChannels, ...channels };

  await recordAuditLog({
    userId: actorUserId,
    action: 'NOTIFICATION_GLOBAL_CHANNELS_UPDATED',
    resource: 'NotificationSetting',
    details: globalChannels,
  });

  return globalChannels;
}

// ----------------------------------------------------------------------------
// Central Notification Dispatcher Engine
// ----------------------------------------------------------------------------

export async function dispatchNotification(payload: SendNotificationPayload): Promise<{
  dispatchedChannels: NotificationChannelType[];
  results: Record<string, any>;
}> {
  const { eventType, templateData, channelsOverride, forceSend } = payload;

  const rule = activeRules.find((r) => r.eventType === eventType);
  if (!rule && !forceSend) {
    logger.warn(`No notification rule found for event ${eventType}`);
    return { dispatchedChannels: [], results: { error: 'Unknown event type' } };
  }

  if (rule && !rule.enabled && !forceSend) {
    logger.info(`Notification event ${eventType} is disabled by administrator. Skipping.`);
    return { dispatchedChannels: [], results: { skipped: 'Event disabled' } };
  }

  // Determine active channels
  const activeChannels: NotificationChannelType[] = [];
  if (channelsOverride && channelsOverride.length > 0) {
    activeChannels.push(...channelsOverride);
  } else if (rule) {
    if (rule.channels.inApp && globalChannels.inApp) activeChannels.push('IN_APP');
    if (rule.channels.email && globalChannels.email) activeChannels.push('EMAIL');
    if (rule.channels.sms && globalChannels.sms) activeChannels.push('SMS');
  }

  const results: Record<string, any> = {};
  const isConnected = await isDatabaseConnected();
  const now = new Date();

  // Find recipient user/customer info
  const targetUserId = payload.recipientUserId || 'user-admin-01';
  const targetCustomerId = payload.recipientCustomerId;
  const recipientPhone = payload.recipientPhone || templateData.phone || '+255712345678';
  const recipientEmail = payload.recipientEmail || templateData.email || 'borrower@nexa.financial';

  // 1. Process IN_APP Channel
  if (activeChannels.includes('IN_APP')) {
    const tmpl = activeTemplates.find((t) => t.eventType === eventType && t.channel === 'IN_APP');
    if (tmpl && tmpl.enabled) {
      const subject = renderTemplate(tmpl.subjectTemplate, templateData);
      const message = renderTemplate(tmpl.bodyTemplate, templateData);
      const notifId = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

      const newDTO: NotificationDTO = {
        id: notifId,
        userId: targetUserId,
        customerId: targetCustomerId || null,
        customerName: templateData.customerName || null,
        eventType,
        channel: 'IN_APP',
        subject,
        message,
        status: 'SENT',
        sentAt: now.toISOString(),
        readAt: null,
        createdAt: now.toISOString(),
      };

      memoryNotifications.unshift(newDTO);

      if (isConnected) {
        try {
          await prisma.notification.create({
            data: {
              id: notifId,
              userId: targetUserId,
              customerId: targetCustomerId || null,
              channel: 'IN_APP',
              subject,
              message,
              status: 'SENT',
              sentAt: now,
            },
          });
        } catch (dbErr) {
          logger.warn('Failed to insert in-app notification into MySQL, saved to memory buffer:', dbErr);
        }
      }

      results.inApp = { success: true, notificationId: notifId };
    }
  }

  // 2. Process SMS Channel (via Extensible Provider Interface)
  if (activeChannels.includes('SMS')) {
    const tmpl = activeTemplates.find((t) => t.eventType === eventType && t.channel === 'SMS');
    if (tmpl && tmpl.enabled) {
      const smsText = renderTemplate(tmpl.bodyTemplate, templateData);
      const smsProvider = getSmsProvider(activeSmsConfig);

      const delivery = await smsProvider.sendSms(recipientPhone, smsText, activeSmsConfig.senderId);
      results.sms = delivery;

      // Record in notification table for traceability
      const smsNotifId = `sms-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      const smsDTO: NotificationDTO = {
        id: smsNotifId,
        userId: targetUserId,
        customerId: targetCustomerId || null,
        customerName: templateData.customerName || null,
        eventType,
        channel: 'SMS',
        subject: `SMS: ${tmpl.subjectTemplate}`,
        message: smsText,
        status: delivery.success ? 'DELIVERED' : 'FAILED',
        sentAt: now.toISOString(),
        readAt: null,
        createdAt: now.toISOString(),
        metadata: { provider: smsProvider.name, simulated: delivery.simulated, segments: delivery.segmentCount },
      };
      memoryNotifications.unshift(smsDTO);
    }
  }

  // 3. Process EMAIL Channel (via Extensible Provider Interface)
  if (activeChannels.includes('EMAIL')) {
    const tmpl = activeTemplates.find((t) => t.eventType === eventType && t.channel === 'EMAIL');
    if (tmpl && tmpl.enabled) {
      const subject = renderTemplate(tmpl.subjectTemplate, templateData);
      const htmlBody = renderTemplate(tmpl.bodyTemplate, templateData);
      const emailProvider = getEmailProvider(activeEmailConfig);

      const delivery = await emailProvider.sendEmail(recipientEmail, subject, htmlBody);
      results.email = delivery;

      // Record in notification table for audit
      const emailNotifId = `email-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      const emailDTO: NotificationDTO = {
        id: emailNotifId,
        userId: targetUserId,
        customerId: targetCustomerId || null,
        customerName: templateData.customerName || null,
        eventType,
        channel: 'EMAIL',
        subject,
        message: htmlBody.replace(/<[^>]*>?/gm, ''), // Plain text preview
        status: delivery.success ? 'DELIVERED' : 'FAILED',
        sentAt: now.toISOString(),
        readAt: null,
        createdAt: now.toISOString(),
        metadata: { provider: emailProvider.name, simulated: delivery.simulated },
      };
      memoryNotifications.unshift(emailDTO);
    }
  }

  return { dispatchedChannels: activeChannels, results };
}

/**
 * Triggers a test dispatch for any event type and channel
 */
export async function testDispatchNotification(
  eventType: NotificationEventType,
  channel: NotificationChannelType,
  recipient: { phone?: string; email?: string; userId?: string },
  actorUserId: string
): Promise<{ success: boolean; result: any }> {
  const sampleData: Record<string, any> = {
    customerName: 'Marcus Mwita',
    customerFirstName: 'Marcus',
    applicationNumber: 'APP-TEST-9921',
    loanNumber: 'LN-TEST-8812',
    amount: '5,000,000',
    approvedAmount: '5,000,000',
    productName: 'Commercial Business Line',
    branchName: 'Dar es Salaam Central Branch',
    interestRate: '9.50',
    termMonths: 12,
    monthlyInstallment: '448,500',
    rejectionReason: 'Debt Service Ratio exceeds policy threshold',
    infoRequestNotes: 'Recent 6-month business bank statement required',
    disbursementMethod: 'BANK_TRANSFER',
    transactionReference: 'TXN-DISB-TEST-01',
    firstDueDate: '2026-11-15',
    dueDate: '2026-11-15',
    installmentNumber: 1,
    amountDue: '448,500',
    receiptNumber: 'RCP-TEST-4421',
    amountPaid: '448,500',
    paymentMethod: 'MOBILE_MONEY',
    principalAllocated: '410,000',
    interestAllocated: '38,500',
    remainingBalance: '4,590,000',
    failureReason: 'Channel timeout or insufficient wallet balance',
    reversalReference: 'REV-TEST-001',
    paymentReference: 'PAY-TEST-991',
    reversalReason: 'Counter teller wrong account adjustment',
    overdueAmount: '448,500',
    daysOverdue: 15,
    penaltyAmount: '22,425',
    totalOverduePayable: '470,925',
    totalPaidAmount: '5,382,000',
  };

  const dispatchResult = await dispatchNotification({
    eventType,
    recipientUserId: recipient.userId || actorUserId,
    recipientPhone: recipient.phone,
    recipientEmail: recipient.email,
    templateData: sampleData,
    channelsOverride: [channel],
    forceSend: true,
  });

  await recordAuditLog({
    userId: actorUserId,
    action: 'TEST_NOTIFICATION_DISPATCHED',
    resource: 'Notification',
    details: { eventType, channel, recipient, results: dispatchResult.results },
  });

  return { success: true, result: dispatchResult.results };
}

/**
 * Scans all active loan schedules for upcoming repayments and overdue installments
 * and dispatches notifications automatically.
 */
export async function scanAndDispatchAlerts(actorUserId: string): Promise<{
  upcomingCount: number;
  overdueCount: number;
  totalDispatched: number;
}> {
  const { getAllLoans } = await import('./loans.service.js');
  const allLoans = await getAllLoans();
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 3600 * 1000);

  let upcomingCount = 0;
  let overdueCount = 0;

  for (const loan of allLoans) {
    if (!['ACTIVE', 'DISBURSED', 'IN_ARREARS', 'DELINQUENT'].includes(loan.status)) continue;

    const schedules = loan.repayments || (loan as any).repaymentSchedules || [];
    const customerName = loan.customer
      ? `${loan.customer.firstName} ${loan.customer.lastName}`.trim()
      : (loan.borrower ? `${loan.borrower.firstName} ${loan.borrower.lastName}`.trim() : 'Borrower');
    const customerPhone = (loan.customer as any)?.phone || (loan.borrower as any)?.phoneNumber || '+255712345678';
    const customerEmail = (loan.customer as any)?.email || (loan.borrower as any)?.email || 'borrower@nexa.financial';
    const targetUserId = loan.borrowerId || loan.customerId || 'user-cust-01';
    const prodName = loan.product?.name || (loan as any).loanProduct?.name || 'Loan';

    for (const sched of schedules) {
      if (sched.status === 'PAID') continue;
      const dueDate = new Date(sched.dueDate);

      // Check upcoming repayment within 3 days
      if (dueDate >= now && dueDate <= threeDaysFromNow && sched.status === 'SCHEDULED') {
        upcomingCount++;
        await dispatchNotification({
          eventType: 'UPCOMING_REPAYMENT',
          recipientUserId: targetUserId,
          recipientCustomerId: loan.customerId,
          recipientPhone: customerPhone,
          recipientEmail: customerEmail,
          templateData: {
            customerName,
            customerFirstName: customerName.split(' ')[0],
            loanNumber: loan.loanNumber,
            dueDate: sched.dueDate ? sched.dueDate.substring(0, 10) : dueDate.toISOString().substring(0, 10),
            installmentNumber: sched.installmentNumber,
            amountDue: (sched.totalDue || sched.installmentAmount || 0).toLocaleString(),
            productName: prodName,
          },
        });
      }

      // Check overdue loans
      if (dueDate < now && (sched.status === 'OVERDUE' || sched.status === 'SCHEDULED' || sched.status === 'PARTIALLY_PAID')) {
        const diffMs = now.getTime() - dueDate.getTime();
        const daysOverdue = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
        overdueCount++;
        await dispatchNotification({
          eventType: 'LOAN_OVERDUE',
          recipientUserId: targetUserId,
          recipientCustomerId: loan.customerId,
          recipientPhone: customerPhone,
          recipientEmail: customerEmail,
          templateData: {
            customerName,
            customerFirstName: customerName.split(' ')[0],
            loanNumber: loan.loanNumber,
            dueDate: sched.dueDate ? sched.dueDate.substring(0, 10) : dueDate.toISOString().substring(0, 10),
            installmentNumber: sched.installmentNumber,
            daysOverdue,
            overdueAmount: (sched.totalDue || sched.installmentAmount || 0).toLocaleString(),
            totalOverduePayable: (sched.totalDue || sched.installmentAmount || 0).toLocaleString(),
            productName: prodName,
          },
        });
      }
    }
  }

  await recordAuditLog({
    userId: actorUserId,
    action: 'NOTIFICATION_ALERTS_SCANNED',
    resource: 'NotificationSystem',
    details: { upcomingCount, overdueCount },
  });

  return {
    upcomingCount,
    overdueCount,
    totalDispatched: upcomingCount + overdueCount,
  };
}
