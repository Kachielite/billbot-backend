export interface ISettlement {
  id: string;
  poolId: string | null;
  fromUser: string | null;
  toUser: string | null;
  amount: string;
  currency: string;
  proofUrl: string | null;
  note: string | null;
  status: string;
  disputedReason: string | null;
  confirmedAt: Date | null;
  createdAt: Date;
}

export interface ISettlementDTO {
  id: string;
  pool_id: string | null;
  from_user: string | null;
  to_user: string | null;
  amount: string;
  currency: string;
  proof_url: string | null;
  note: string | null;
  status: string;
  disputed_reason: string | null;
  confirmed_at: Date | null;
  created_at: Date;
}
