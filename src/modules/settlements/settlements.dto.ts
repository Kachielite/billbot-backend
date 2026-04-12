import { z } from 'zod';

export const CreateSettlementSchema = z.object({
  toUserId: z.string().uuid(),
  amount: z.coerce.number().positive(),
  note: z.string().max(500).optional(),
});
export type CreateSettlementDTO = z.infer<typeof CreateSettlementSchema>;

export const DisputeSettlementSchema = z.object({
  reason: z.string().min(1, 'Dispute reason is required').max(500),
});
export type DisputeSettlementDTO = z.infer<typeof DisputeSettlementSchema>;
