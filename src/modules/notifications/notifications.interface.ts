export type NotificationType =
  | 'invite.received'
  | 'member.joined'
  | 'expense.created'
  | 'settlement.submitted'
  | 'settlement.confirmed'
  | 'settlement.disputed'
  | 'general';

export interface INotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  isRead: boolean;
  createdAt: Date;
}

export interface ICreateNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}
