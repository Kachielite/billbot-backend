import { inject, injectable } from 'tsyringe';
import { eq } from 'drizzle-orm';
import Database from '@/common/lib/database';
import { WebhookSubscriptionSchema, WebhookDeliverySchema } from './webhooks.schema';
import { IWebhookSubscription, IWebhookDelivery } from './webhooks.interface';

export interface IWebhookRepository {
  createSubscription(data: {
    id: string;
    groupId: string;
    url: string;
    secret: string;
    events: string[];
    createdBy: string;
  }): Promise<IWebhookSubscription>;
  findSubscriptionsByGroup(groupId: string): Promise<IWebhookSubscription[]>;
  findSubscriptionsByGroupAndEvent(groupId: string, event: string): Promise<IWebhookSubscription[]>;
  deleteSubscription(id: string): Promise<void>;
  createDelivery(data: {
    id: string;
    subscriptionId: string;
    eventType: string;
    payload: Record<string, unknown>;
  }): Promise<IWebhookDelivery>;
  updateDelivery(
    id: string,
    data: Partial<{
      status: string;
      responseCode: number;
      attempts: number;
      lastAttemptedAt: Date;
    }>,
  ): Promise<void>;
}

@injectable()
class WebhookRepositoryImpl implements IWebhookRepository {
  constructor(@inject(Database) private db: Database) {}

  async createSubscription(data: {
    id: string;
    groupId: string;
    url: string;
    secret: string;
    events: string[];
    createdBy: string;
  }): Promise<IWebhookSubscription> {
    const [row] = await this.db.client.insert(WebhookSubscriptionSchema).values(data).returning();
    return row as unknown as IWebhookSubscription;
  }

  async findSubscriptionsByGroup(groupId: string): Promise<IWebhookSubscription[]> {
    const rows = await this.db.client
      .select()
      .from(WebhookSubscriptionSchema)
      .where(eq(WebhookSubscriptionSchema.groupId, groupId));
    return rows as unknown as IWebhookSubscription[];
  }

  async findSubscriptionsByGroupAndEvent(
    groupId: string,
    _event: string,
  ): Promise<IWebhookSubscription[]> {
    // Fetch all for group — filter by event in dispatcher
    return this.findSubscriptionsByGroup(groupId);
  }

  async deleteSubscription(id: string): Promise<void> {
    await this.db.client
      .delete(WebhookSubscriptionSchema)
      .where(eq(WebhookSubscriptionSchema.id, id));
  }

  async createDelivery(data: {
    id: string;
    subscriptionId: string;
    eventType: string;
    payload: Record<string, unknown>;
  }): Promise<IWebhookDelivery> {
    const [row] = await this.db.client.insert(WebhookDeliverySchema).values(data).returning();
    return row as unknown as IWebhookDelivery;
  }

  async updateDelivery(
    id: string,
    data: Partial<{
      status: string;
      responseCode: number;
      attempts: number;
      lastAttemptedAt: Date;
    }>,
  ): Promise<void> {
    const updateData: Partial<typeof WebhookDeliverySchema.$inferInsert> = {};
    if (data.status !== undefined) updateData.status = data.status;
    if (data.responseCode !== undefined) updateData.responseCode = data.responseCode;
    if (data.attempts !== undefined) updateData.attempts = data.attempts;
    if (data.lastAttemptedAt !== undefined) updateData.lastAttemptedAt = data.lastAttemptedAt;

    await this.db.client
      .update(WebhookDeliverySchema)
      .set(updateData)
      .where(eq(WebhookDeliverySchema.id, id));
  }
}

export default WebhookRepositoryImpl;
