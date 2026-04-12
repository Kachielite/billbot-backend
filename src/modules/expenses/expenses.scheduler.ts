import { inject, injectable } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';
import { IExpenseRepository } from './expenses.repository';
import { IPoolRepository } from '@/modules/pools/pools.repository';
import { WebhookDispatcher } from '@/modules/webhooks/webhooks.dispatcher';
import { RecurrenceFrequency } from './expenses.enum';
import { computeNextOccurrence } from './expenses.service';
import logger from '@/common/lib/logger';

const SCHEDULER_INTERVAL_MS = 60 * 60 * 1000; // check every hour

@injectable()
export class RecurringExpenseScheduler {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @inject('IExpenseRepository') private expenseRepository: IExpenseRepository,
    @inject('IPoolRepository') private poolRepository: IPoolRepository,
    @inject(WebhookDispatcher) private webhookDispatcher: WebhookDispatcher,
  ) {}

  start(): void {
    if (this.timer) return;
    // Run immediately on boot, then on the interval
    this.process().catch((err) => logger.error(`Recurring expense scheduler error: ${err}`));
    this.timer = setInterval(() => {
      this.process().catch((err) => logger.error(`Recurring expense scheduler error: ${err}`));
    }, SCHEDULER_INTERVAL_MS);
    this.timer.unref(); // don't keep the process alive if nothing else is running
    logger.info('RecurringExpenseScheduler started.');
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async process(): Promise<void> {
    const due = await this.expenseRepository.getDueRecurring();
    if (due.length === 0) return;

    logger.info(`RecurringExpenseScheduler: processing ${due.length} due expense(s).`);

    for (const template of due) {
      try {
        await this.createInstance(template);
      } catch (err) {
        logger.error(
          `RecurringExpenseScheduler: failed to generate instance for expense ${template.id}: ${err}`,
        );
      }
    }
  }

  private async createInstance(template: {
    id: string;
    poolId: string;
    paidBy: string | null;
    amount: string;
    currency: string;
    description: string | null;
    category: string | null;
    isRecurring: boolean;
    recurrenceFrequency: string | null;
    recurrenceEndDate: Date | null;
    nextOccurrenceAt: Date | null;
  }): Promise<void> {
    if (!template.paidBy || !template.recurrenceFrequency || !template.nextOccurrenceAt) return;

    // Create the child expense instance (not itself recurring)
    const instance = await this.expenseRepository.create({
      id: uuidv4(),
      poolId: template.poolId,
      paidBy: template.paidBy,
      amount: template.amount,
      currency: template.currency,
      description: template.description,
      category: template.category,
      receiptUrl: null,
      isRecurring: false,
      recurrenceFrequency: null,
      recurrenceEndDate: null,
      recurrenceParentId: template.id,
      nextOccurrenceAt: null,
    });

    // Create equal splits for all current pool members
    const members = await this.poolRepository.getMembers(template.poolId);
    if (members.length > 0) {
      const splitAmount = (parseFloat(template.amount) / members.length).toFixed(2);
      for (const m of members) {
        await this.expenseRepository.createSplit({
          id: uuidv4(),
          expenseId: instance.id,
          owedBy: m.userId,
          amount: splitAmount,
        });
      }
    }

    // Advance nextOccurrenceAt from the scheduled time (not from now) to prevent drift
    const nextAt = computeNextOccurrence(
      template.nextOccurrenceAt,
      template.recurrenceFrequency as RecurrenceFrequency,
    );

    const endDate = template.recurrenceEndDate;
    const isStillActive = !endDate || nextAt <= endDate;

    await this.expenseRepository.updateRecurring(template.id, {
      nextOccurrenceAt: isStillActive ? nextAt : null,
      isRecurring: isStillActive,
    });

    // Fire webhook on the group
    const pool = await this.poolRepository.findById(template.poolId);
    if (pool) {
      this.webhookDispatcher.dispatch(pool.groupId, 'expense.created', {
        expense_id: instance.id,
        pool_id: template.poolId,
        amount: template.amount,
        recurring: true,
        parent_id: template.id,
      });
    }

    logger.info(
      `RecurringExpenseScheduler: created instance ${instance.id} from template ${template.id}. Next: ${isStillActive ? nextAt.toISOString() : 'none (ended)'}.`,
    );
  }
}
