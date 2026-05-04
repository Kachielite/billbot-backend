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

export interface IDeviceToken {
  id: string;
  userId: string;
  playerId: string;
  platform: string | null;
  createdAt: Date;
}

export interface INotificationPreferences {
  userId: string;
  invite_received: boolean;
  member_joined: boolean;
  expense_created: boolean;
  settlement_submitted: boolean;
  settlement_confirmed: boolean;
  settlement_disputed: boolean;
  general: boolean;
}

export interface IUpdateNotificationPreferences {
  invite_received?: boolean;
  member_joined?: boolean;
  expense_created?: boolean;
  settlement_submitted?: boolean;
  settlement_confirmed?: boolean;
  settlement_disputed?: boolean;
  general?: boolean;
}
