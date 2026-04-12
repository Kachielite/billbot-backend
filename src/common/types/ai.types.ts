export interface IParsedReceipt {
  amount: number | null;
  currency: string | null;
  merchant: string | null;
  description: string | null;
  category: string | null;
  date: string | null;
}

export interface IParsedSettlementProof {
  amount: number | null;
  currency: string | null;
  sender: string | null;
  recipient: string | null;
  reference: string | null;
  date: string | null;
  platform: string | null;
}
