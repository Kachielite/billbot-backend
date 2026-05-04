import { inject, injectable } from 'tsyringe';
import { INotificationRepository } from './notifications.repository';
import { IUserRepository } from '@/modules/users/users.repository';
import { generateReminderMessages } from '@/common/lib/ai-parser';
import { sendPushNotification } from '@/common/lib/push';
import logger from '@/common/lib/logger';

type ReminderPeriod = 'beginning' | 'mid' | 'end';

const SCHEDULER_INTERVAL_MS = 60 * 60 * 1000; // check every hour

function getReminderPeriod(date: Date): ReminderPeriod | null {
  const day = date.getDate();
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  if (day === 1) return 'beginning';
  if (day === 15) return 'mid';
  if (day === lastDay) return 'end';
  return null;
}

function periodKey(period: ReminderPeriod, date: Date): string {
  return `${period}-${date.getFullYear()}-${date.getMonth() + 1}`;
}

@injectable()
export class ReminderScheduler {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @inject('INotificationRepository') private notificationRepository: INotificationRepository,
    @inject('IUserRepository') private userRepository: IUserRepository,
  ) {}

  start(): void {
    if (this.timer) return;
    this.process().catch((err) => logger.error(`ReminderScheduler error: ${err}`));
    this.timer = setInterval(() => {
      this.process().catch((err) => logger.error(`ReminderScheduler error: ${err}`));
    }, SCHEDULER_INTERVAL_MS);
    this.timer.unref();
    logger.info('ReminderScheduler started.');
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async process(): Promise<void> {
    const now = new Date();
    const period = getReminderPeriod(now);
    if (!period) return;

    const key = periodKey(period, now);
    const alreadySent = await this.notificationRepository.hasReminderBeenSent(key);
    if (alreadySent) return;

    // Claim the slot immediately to prevent concurrent sends on multi-instance deploys
    await this.notificationRepository.markReminderSent(key);

    const targets = await this.notificationRepository.findUsersEligibleForReminders();
    if (targets.length === 0) {
      logger.info(`ReminderScheduler [${key}]: no eligible users.`);
      return;
    }

    logger.info(`ReminderScheduler [${key}]: sending to ${targets.length} user(s).`);

    const monthName = now.toLocaleString('en-US', { month: 'long' });
    const messages = await generateReminderMessages(period, monthName, 3);

    // Fetch user names for personalisation (one query)
    const userIds = targets.map((t) => t.userId);
    const users = await this.userRepository.findByIds(userIds);
    const nameMap = new Map(users.map((u) => [u.id, u.name.split(' ')[0]]));

    let sent = 0;
    for (let i = 0; i < targets.length; i++) {
      const { userId, playerIds } = targets[i];
      // Rotate through the AI variants so not everyone gets the same message
      const msg = messages[i % messages.length];
      const firstName = nameMap.get(userId) ?? 'friend';

      const body = msg.body.replace(/\{name\}/g, firstName);
      const title = msg.title.replace(/\{name\}/g, firstName);

      try {
        await sendPushNotification(playerIds, title, body, {
          type: 'general',
          action: 'log_expense',
          period,
        });
        sent++;
      } catch (err) {
        logger.warn(`ReminderScheduler: failed to push to user ${userId}: ${err}`);
      }
    }

    logger.info(`ReminderScheduler [${key}]: pushed to ${sent}/${targets.length} user(s).`);
  }
}
