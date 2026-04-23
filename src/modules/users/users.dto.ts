import { z } from 'zod';

export const UpdateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  avatar_url: z.string().url().nullable().optional(),
  phone: z.string().nullable().optional(),
});
export type UpdateUserDTO = z.infer<typeof UpdateUserSchema>;

export const UserResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  avatar_url: z.string().nullable(),
  currency: z.string(),
  created_at: z.date(),
});
export type UserResponseDTO = z.infer<typeof UserResponseSchema>;
