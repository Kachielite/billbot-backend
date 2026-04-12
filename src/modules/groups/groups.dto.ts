import { z } from 'zod';

export const CreateGroupSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
});
export type CreateGroupDTO = z.infer<typeof CreateGroupSchema>;

export const GroupResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  invite_code: z.string(),
  created_by: z.string().nullable(),
  created_at: z.date(),
});
export type GroupResponseDTO = z.infer<typeof GroupResponseSchema>;
