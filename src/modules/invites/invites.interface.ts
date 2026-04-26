export interface IInvite {
  id: string;
  groupId: string;
  invitedBy: string | null;
  phone: string | null;
  email: string | null;
  token: string;
  code: string;
  status: string;
  expiresAt: Date;
  createdAt: Date;
}
