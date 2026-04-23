import { z } from 'zod';

const VALID_EVENTS = [
  'group.created',
  'member.invited',
  'member.joined',
  'member.removed',
  'pool.created',
  'pool.settled',
  'pool.member_added',
  'pool.deleted',
  'pool.archived',
  'expense.created',
  'expense.deleted',
  'settlement.submitted',
  'settlement.confirmed',
  'settlement.disputed',
] as const;

export const CreateWebhookSchema = z.object({
  url: z
    .string()
    .url('Must be a valid URL')
    .refine((url) => url.startsWith('https://'), {
      message: 'Webhook URL must use HTTPS.',
    })
    .refine(
      (url) => {
        try {
          const { hostname } = new URL(url);
          // Reject bare IP literals and obviously internal hostnames at schema time.
          // DNS-level SSRF check happens asynchronously in the service.
          const blockedHostnames = ['localhost', '0.0.0.0', '::1'];
          return !blockedHostnames.includes(hostname.toLowerCase());
        } catch {
          return false;
        }
      },
      { message: 'Webhook URL targets a disallowed host.' },
    ),
  events: z.array(z.enum(VALID_EVENTS)).min(1, 'At least one event is required'),
});
export type CreateWebhookDTO = z.infer<typeof CreateWebhookSchema>;
