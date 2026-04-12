import { z } from 'zod';

export const GoogleAuthSchema = z.object({
  idToken: z.string().min(1, 'idToken is required'),
});
export type GoogleAuthDTO = z.infer<typeof GoogleAuthSchema>;

export const AppleAuthSchema = z.object({
  identityToken: z.string().min(1, 'identityToken is required'),
  fullName: z
    .object({
      givenName: z.string().nullable().optional(),
      familyName: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  email: z.string().email().nullable().optional(),
});
export type AppleAuthDTO = z.infer<typeof AppleAuthSchema>;
