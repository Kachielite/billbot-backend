import { z } from 'zod';
import { ExpenseCategory, Currency, RecurrenceFrequency } from './expenses.enum';

export const CreateExpenseSchema = z
  .object({
    amount: z.coerce.number().positive('Amount must be positive'),
    description: z.string().max(255).optional(),
    category: z.nativeEnum(ExpenseCategory).optional(),
    currency: z.nativeEnum(Currency).default(Currency.NGN),
    isRecurring: z.coerce.boolean().optional().default(false),
    recurrenceFrequency: z.nativeEnum(RecurrenceFrequency).optional(),
    recurrenceEndDate: z
      .string()
      .datetime({ message: 'recurrenceEndDate must be an ISO 8601 date-time string' })
      .optional(),
  })
  .refine((d) => !d.isRecurring || !!d.recurrenceFrequency, {
    message: 'recurrenceFrequency is required when isRecurring is true',
    path: ['recurrenceFrequency'],
  });

export type CreateExpenseDTO = z.infer<typeof CreateExpenseSchema>;

export const ExpenseResponseSchema = z.object({
  id: z.string(),
  pool_id: z.string(),
  paid_by: z.string().nullable(),
  amount: z.string(),
  currency: z.string(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  receipt_url: z.string().nullable(),
  created_at: z.date(),
  is_recurring: z.boolean(),
  recurrence_frequency: z.string().nullable(),
  recurrence_end_date: z.date().nullable(),
  recurrence_parent_id: z.string().nullable(),
  next_occurrence_at: z.date().nullable(),
});
export type ExpenseResponseDTO = z.infer<typeof ExpenseResponseSchema>;
