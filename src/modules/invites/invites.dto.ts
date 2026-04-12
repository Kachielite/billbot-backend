import { z } from 'zod';

export const CreateInviteSchema = z
  .object({
    phone: z.string().optional(),
    email: z.string().email().optional(),
  })
  .refine((data) => data.phone || data.email, {
    message: 'Either phone or email is required',
  });
export type CreateInviteDTO = z.infer<typeof CreateInviteSchema>;
