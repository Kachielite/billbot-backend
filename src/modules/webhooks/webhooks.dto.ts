import { z } from 'zod';

const VALID_EVENTS = [
  'group.created',
  'member.invited',
  'member.joined',
  'member.removed',
  'pool.created',
  'pool.settled',
  'pool.member_added',
  'expense.created',
  'expense.deleted',
  'settlement.submitted',
  'settlement.confirmed',
  'settlement.disputed',
] as const;

export const CreateWebhookSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  events: z.array(z.enum(VALID_EVENTS)).min(1, 'At least one event is required'),
});
export type CreateWebhookDTO = z.infer<typeof CreateWebhookSchema>;
