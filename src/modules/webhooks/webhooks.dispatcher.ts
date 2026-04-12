import { inject, injectable } from 'tsyringe';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { IWebhookRepository } from './webhooks.repository';
import { WebhookEventType } from './webhooks.interface';
import { assertSafeWebhookUrl } from '@/common/utils/ssrf-guard';
import logger from '@/common/lib/logger';

const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000]; // 1m, 5m, 30m
const TIMEOUT_MS = 10_000;

@injectable()
export class WebhookDispatcher {
  constructor(@inject('IWebhookRepository') private webhookRepository: IWebhookRepository) {}

  dispatch(groupId: string, eventType: WebhookEventType, data: Record<string, unknown>): void {
    // Fire and forget — non-blocking
    this.dispatchAsync(groupId, eventType, data).catch((err) =>
      logger.error(`Webhook dispatch error: ${err}`),
    );
  }

  private async dispatchAsync(
    groupId: string,
    eventType: WebhookEventType,
    data: Record<string, unknown>,
  ): Promise<void> {
    const subscriptions = await this.webhookRepository.findSubscriptionsByGroup(groupId);

    const relevantSubs = subscriptions.filter((sub) => sub.events.includes(eventType));

    const payload = {
      event: eventType,
      group_id: groupId,
      timestamp: new Date().toISOString(),
      data,
    };

    for (const sub of relevantSubs) {
      const delivery = await this.webhookRepository.createDelivery({
        id: uuidv4(),
        subscriptionId: sub.id,
        eventType,
        payload,
      });

      this.deliverWithRetry(delivery.id, sub.url, sub.secret, payload, 0);
    }
  }

  private deliverWithRetry(
    deliveryId: string,
    url: string,
    secret: string,
    payload: Record<string, unknown>,
    attempt: number,
  ): void {
    const body = JSON.stringify(payload);
    const signature = this.sign(body, secret);

    // Defense-in-depth SSRF check before each delivery (re-check on retries too)
    assertSafeWebhookUrl(url)
      .then(() => this.doFetch(deliveryId, url, body, signature, payload, secret, attempt))
      .catch((err) => {
        logger.warn(`Webhook delivery blocked (SSRF guard): ${err.message}`);
        this.webhookRepository
          .updateDelivery(deliveryId, {
            status: 'failed',
            attempts: attempt + 1,
            lastAttemptedAt: new Date(),
          })
          .catch(() => {});
      });
  }

  private doFetch(
    deliveryId: string,
    url: string,
    body: string,
    signature: string,
    payload: Record<string, unknown>,
    secret: string,
    attempt: number,
  ): void {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-BillBot-Signature': signature,
      },
      body,
      signal: controller.signal,
    })
      .then(async (res) => {
        clearTimeout(timeoutId);
        await this.webhookRepository.updateDelivery(deliveryId, {
          status: res.ok ? 'delivered' : 'failed',
          responseCode: res.status,
          attempts: attempt + 1,
          lastAttemptedAt: new Date(),
        });

        if (!res.ok && attempt < RETRY_DELAYS_MS.length - 1) {
          setTimeout(
            () => this.deliverWithRetry(deliveryId, url, secret, payload, attempt + 1),
            RETRY_DELAYS_MS[attempt + 1],
          );
        }
      })
      .catch(async (err) => {
        clearTimeout(timeoutId);
        logger.warn(`Webhook delivery attempt ${attempt + 1} failed for ${url}: ${err}`);

        await this.webhookRepository.updateDelivery(deliveryId, {
          status: 'failed',
          attempts: attempt + 1,
          lastAttemptedAt: new Date(),
        });

        if (attempt < RETRY_DELAYS_MS.length - 1) {
          setTimeout(
            () => this.deliverWithRetry(deliveryId, url, secret, payload, attempt + 1),
            RETRY_DELAYS_MS[attempt + 1],
          );
        }
      });
  }

  private sign(body: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(body).digest('hex');
  }
}
