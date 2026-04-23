export interface IWebhookSubscription {
  id: string;
  groupId: string;
  url: string;
  secret: string;
  events: string[];
  createdBy: string | null;
  createdAt: Date;
}

export interface IWebhookDelivery {
  id: string;
  subscriptionId: string;
  eventType: string;
  payload: Record<string, unknown>;
  status: string;
  responseCode: number | null;
  attempts: number;
  lastAttemptedAt: Date | null;
  createdAt: Date;
}

export type WebhookEventType =
  | 'group.created'
  | 'member.invited'
  | 'member.joined'
  | 'member.removed'
  | 'pool.created'
  | 'pool.settled'
  | 'pool.member_added'
  | 'pool.deleted'
  | 'pool.archived'
  | 'expense.created'
  | 'expense.deleted'
  | 'settlement.submitted'
  | 'settlement.confirmed'
  | 'settlement.disputed';
