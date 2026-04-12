import { z } from 'zod';
import { ExpenseCategory, Currency } from './expenses.enum';

export const CreateExpenseSchema = z.object({
  amount: z.coerce.number().positive('Amount must be positive'),
  description: z.string().max(255).optional(),
  category: z.nativeEnum(ExpenseCategory).optional(),
  currency: z.nativeEnum(Currency).default(Currency.NGN),
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
});
export type ExpenseResponseDTO = z.infer<typeof ExpenseResponseSchema>;
