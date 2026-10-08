import { prisma, isDatabaseConnected } from '../db/prisma.js';
import { recordAuditLog } from './audit.service.js';
import { logger } from '../utils/logger.js';
import { WorkflowSettingsDTO } from '../../shared/types/index.js';

export interface SettingItem {
  key: string;
  value: string;
  description: string;
  group: 'GENERAL' | 'LOAN_DEFAULTS' | 'ACCOUNTING' | 'NOTIFICATIONS' | 'SECURITY';
}

const DEFAULT_SETTINGS: SettingItem[] = [
  {
    key: 'INSTITUTION_NAME',
    value: 'Nexa Financial Capital Corp',
    description: 'Corporate institutional name used on facility agreements',
    group: 'GENERAL',
  },
  {
    key: 'BASE_CURRENCY',
    value: 'TZS',
    description: 'Standard operating settlement currency (Tanzanian Shillings)',
    group: 'ACCOUNTING',
  },
  {
    key: 'DEFAULT_INTEREST_RATE',
    value: '8.75',
    description: 'Default baseline APR applied to new credit facilities',
    group: 'LOAN_DEFAULTS',
  },
  {
    key: 'MAX_SINGLE_BORROWER_EXPOSURE',
    value: '250000.00',
    description: 'Maximum credit ceiling per corporate/retail entity',
    group: 'LOAN_DEFAULTS',
  },
  {
    key: 'GRACE_PERIOD_DAYS',
    value: '5',
    description: 'Days before late payment delinquency penalty accrual begins',
    group: 'LOAN_DEFAULTS',
  },
  {
    key: 'LATE_PAYMENT_PENALTY_RATE',
    value: '0.05',
    description: 'Delinquency penalty rate charged on past-due installment',
    group: 'LOAN_DEFAULTS',
  },
  {
    key: 'SESSION_IDLE_TIMEOUT_MINUTES',
    value: '30',
    description: 'Idle minutes before staff authentication token expires',
    group: 'SECURITY',
  },
  {
    key: 'MAX_LOGIN_ATTEMPTS',
    value: '5',
    description: 'Maximum consecutive failed login attempts before account lock',
    group: 'SECURITY',
  },
];

const activeMemorySettings = [...DEFAULT_SETTINGS];

export async function getSystemSettings(): Promise<SettingItem[]> {
  const isConnected = await isDatabaseConnected();
  if (isConnected) {
    try {
      const dbSettings = await prisma.systemSetting.findMany({
        orderBy: { group: 'asc' },
      });
      if (dbSettings.length > 0) {
        return dbSettings.map((s) => ({
          key: s.key,
          value: s.value,
          description: s.description || '',
          group: s.group as any,
        }));
      }
    } catch (err) {
      logger.error('Error fetching settings from MySQL:', err);
    }
  }

  return activeMemorySettings;
}

export async function updateSystemSettings(
  settings: Array<{ key: string; value: string }>,
  actorUserId: string
): Promise<SettingItem[]> {
  const isConnected = await isDatabaseConnected();

  if (isConnected) {
    for (const item of settings) {
      await prisma.systemSetting.upsert({
        where: { key: item.key },
        update: { value: item.value, updatedByUserId: actorUserId },
        create: {
          key: item.key,
          value: item.value,
          updatedByUserId: actorUserId,
          group: 'GENERAL',
        },
      });
    }

    await recordAuditLog({
      userId: actorUserId,
      action: 'SYSTEM_SETTINGS_UPDATED',
      resource: 'SystemSetting',
      details: { updatedKeys: settings.map((s) => s.key) },
    });

    return getSystemSettings();
  }

  // Memory fallback
  for (const item of settings) {
    const existing = activeMemorySettings.find((s) => s.key === item.key);
    if (existing) {
      existing.value = item.value;
    } else {
      activeMemorySettings.push({
        key: item.key,
        value: item.value,
        description: 'Custom configuration variable',
        group: 'GENERAL',
      });
    }
  }

  await recordAuditLog({
    userId: actorUserId,
    action: 'SYSTEM_SETTINGS_UPDATED',
    resource: 'SystemSetting',
    details: { updatedKeys: settings.map((s) => s.key) },
  });

  return activeMemorySettings;
}

const DEFAULT_WORKFLOW_SETTINGS: WorkflowSettingsDTO = {
  rolePermissions: [
    {
      role: 'LOAN_OFFICER',
      canReview: true,
      canRequestInfo: true,
      canRecommend: true,
      canAssessCredit: false,
      canApprove: false,
      canReject: false,
      canDisburse: false,
      canClose: false,
      maxApprovalLimitTZS: 0,
    },
    {
      role: 'CREDIT_OFFICER',
      canReview: true,
      canRequestInfo: true,
      canRecommend: true,
      canAssessCredit: true,
      canApprove: true,
      canReject: true,
      canDisburse: false,
      canClose: false,
      maxApprovalLimitTZS: 50_000_000,
    },
    {
      role: 'BRANCH_MANAGER',
      canReview: true,
      canRequestInfo: true,
      canRecommend: true,
      canAssessCredit: true,
      canApprove: true,
      canReject: true,
      canDisburse: true,
      canClose: true,
      maxApprovalLimitTZS: 250_000_000,
    },
    {
      role: 'ADMIN',
      canReview: true,
      canRequestInfo: true,
      canRecommend: true,
      canAssessCredit: true,
      canApprove: true,
      canReject: true,
      canDisburse: true,
      canClose: true,
      maxApprovalLimitTZS: 1_000_000_000,
    },
    {
      role: 'SUPER_ADMIN',
      canReview: true,
      canRequestInfo: true,
      canRecommend: true,
      canAssessCredit: true,
      canApprove: true,
      canReject: true,
      canDisburse: true,
      canClose: true,
      maxApprovalLimitTZS: 10_000_000_000,
    },
    {
      role: 'CASHIER',
      canReview: false,
      canRequestInfo: false,
      canRecommend: false,
      canAssessCredit: false,
      canApprove: false,
      canReject: false,
      canDisburse: true,
      canClose: false,
      maxApprovalLimitTZS: 0,
    },
  ],
  requireDualApprovalAboveTZS: 100_000_000,
  allowSelfApproval: false,
  autoAssignLoanOfficers: true,
  enforceDocumentChecklistBeforeAssessment: true,
};

let activeWorkflowSettings: WorkflowSettingsDTO = { ...DEFAULT_WORKFLOW_SETTINGS };

export async function getWorkflowSettings(): Promise<WorkflowSettingsDTO> {
  const isConnected = await isDatabaseConnected();
  if (isConnected) {
    try {
      const setting = await prisma.systemSetting.findUnique({
        where: { key: 'WORKFLOW_PERMISSIONS_CONFIG' },
      });
      if (setting && setting.value) {
        return JSON.parse(setting.value);
      }
    } catch (err) {
      logger.error('Error fetching workflow settings from MySQL:', err);
    }
  }

  return activeWorkflowSettings;
}

export async function updateWorkflowSettings(
  actorUserId: string,
  settings: WorkflowSettingsDTO
): Promise<WorkflowSettingsDTO> {
  const isConnected = await isDatabaseConnected();
  if (isConnected) {
    try {
      await prisma.systemSetting.upsert({
        where: { key: 'WORKFLOW_PERMISSIONS_CONFIG' },
        update: { value: JSON.stringify(settings), updatedByUserId: actorUserId },
        create: {
          key: 'WORKFLOW_PERMISSIONS_CONFIG',
          value: JSON.stringify(settings),
          updatedByUserId: actorUserId,
          group: 'SECURITY',
        },
      });
    } catch (err) {
      logger.error('Error saving workflow settings to MySQL:', err);
    }
  }

  activeWorkflowSettings = { ...settings };

  await recordAuditLog({
    userId: actorUserId,
    action: 'WORKFLOW_PERMISSIONS_UPDATED',
    resource: 'WorkflowSettings',
    details: { rolesUpdated: settings.rolePermissions.map((r) => r.role) },
  });

  return activeWorkflowSettings;
}
