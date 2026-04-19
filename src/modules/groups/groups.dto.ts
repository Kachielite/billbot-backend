import { z } from 'zod';

export const CreateGroupSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  emoji: z.string().max(10).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'color must be a valid hex color (e.g. #FF5733)')
    .optional(),
});
export type CreateGroupDTO = z.infer<typeof CreateGroupSchema>;

export const GroupBalanceSchema = z.object({
  total_owed: z.number(),
  total_owed_to_me: z.number(),
  net_balance: z.number(),
  currency: z.string(),
});
export type GroupBalanceDTO = z.infer<typeof GroupBalanceSchema>;

export const GroupMemberDetailSchema = z.object({
  user_id: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  avatar_url: z.string().nullable(),
  role: z.string(),
  joined_at: z.date(),
});
export type GroupMemberDetailDTO = z.infer<typeof GroupMemberDetailSchema>;

export const GroupResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  emoji: z.string().nullable(),
  color: z.string().nullable(),
  invite_code: z.string(),
  created_by: z.string().nullable(),
  created_at: z.date(),
  member_count: z.number(),
  balance: GroupBalanceSchema,
  members: z.array(GroupMemberDetailSchema).optional(),
});
export type GroupResponseDTO = z.infer<typeof GroupResponseSchema>;
