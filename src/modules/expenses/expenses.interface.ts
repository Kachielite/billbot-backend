export interface IExpense {
  id: string;
  poolId: string;
  paidBy: string | null;
  amount: string;
  currency: string;
  description: string | null;
  category: string | null;
  receiptUrl: string | null;
  createdAt: Date;
}

export interface IExpenseSplit {
  id: string;
  expenseId: string;
  owedBy: string | null;
  amount: string;
  settled: boolean;
  settledAt: Date | null;
}

export interface IParsedReceipt {
  amount: number | null;
  currency: string | null;
  merchant: string | null;
  description: string | null;
  category: string | null;
  date: string | null;
}
