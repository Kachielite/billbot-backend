import { z } from 'zod';
import { PoolStatus } from './pools.enum';

export const CreatePoolSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  memberIds: z.array(z.string().uuid()).min(1, 'At least one member is required'),
});
export type CreatePoolDTO = z.infer<typeof CreatePoolSchema>;

export const UpdatePoolSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  status: z.nativeEnum(PoolStatus).optional(),
});
export type UpdatePoolDTO = z.infer<typeof UpdatePoolSchema>;

export const AddPoolMemberSchema = z.object({
  userId: z.string().uuid(),
});
export type AddPoolMemberDTO = z.infer<typeof AddPoolMemberSchema>;
