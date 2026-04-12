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
