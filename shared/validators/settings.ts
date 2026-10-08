import { z } from 'zod';

export const UpdateSystemSettingSchema = z.object({
  key: z.string().trim().min(1, 'Setting key is required'),
  value: z.string().trim().min(1, 'Setting value is required'),
});

export const BulkUpdateSettingsSchema = z.object({
  settings: z.array(UpdateSystemSettingSchema).min(1, 'At least one setting must be provided'),
});

export type UpdateSystemSettingInput = z.infer<typeof UpdateSystemSettingSchema>;
export type BulkUpdateSettingsInput = z.infer<typeof BulkUpdateSettingsSchema>;
