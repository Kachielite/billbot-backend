import { z } from 'zod';

export const RegisterDeviceTokenSchema = z.object({
  player_id: z.string().min(1),
  platform: z.enum(['ios', 'android', 'web']).optional(),
});
export type RegisterDeviceTokenDTO = z.infer<typeof RegisterDeviceTokenSchema>;

export const UpdatePreferencesSchema = z.object({
  invite_received: z.boolean().optional(),
  member_joined: z.boolean().optional(),
  expense_created: z.boolean().optional(),
  settlement_submitted: z.boolean().optional(),
  settlement_confirmed: z.boolean().optional(),
  settlement_disputed: z.boolean().optional(),
  general: z.boolean().optional(),
});
export type UpdatePreferencesDTO = z.infer<typeof UpdatePreferencesSchema>;
