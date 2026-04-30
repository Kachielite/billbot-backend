export interface IExpense {
  id: string;
  poolId: string;
  paidBy: string | null;
  amount: string;
  currency: string;
  description: string | null;
  categoryId: string | null;
  receiptUrl: string | null;
  createdAt: Date;
  isRecurring: boolean;
  recurrenceFrequency: string | null;
  recurrenceEndDate: Date | null;
  recurrenceParentId: string | null;
  nextOccurrenceAt: Date | null;
}

export interface IExpenseSplit {
  id: string;
  expenseId: string;
  owedBy: string | null;
  amount: string;
  amountSettled: string;
  amountRemaining: string;
  settled: boolean;
  settledAt: Date | null;
}

export interface IExpenseFilter {
  status?: 'pending' | 'settled';
  from?: Date;
  to?: Date;
}

export interface IParsedReceipt {
  amount: number | null;
  currency: string | null;
  merchant: string | null;
  description: string | null;
  category: string | null;
  date: string | null;
}
