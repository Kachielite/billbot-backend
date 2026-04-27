import { inject, injectable } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';
import { ISettlementRepository } from './settlements.repository';
import { ISettlement, ISettlementDTO } from './settlements.interface';
import { CreateSettlementDTO, DisputeSettlementDTO } from './settlements.dto';
import { IGeneralResponse } from '@/common/types/interface';
import { IPoolRepository } from '@/modules/pools/pools.repository';
import { IExpenseRepository } from '@/modules/expenses/expenses.repository';
import { WebhookDispatcher } from '@/modules/webhooks/webhooks.dispatcher';
import { IActivityRepository } from '@/modules/activities/activities.repository';
import NotificationService, {
  INotificationService,
} from '@/modules/notifications/notifications.service';
import { uploadFile } from '@/common/lib/storage';
import { parseSettlementProof } from '@/common/lib/ai-parser';
import {
  BadRequestException,
  ForbiddenException,
  InternalServerException,
  ResourceNotFoundException,
} from '@/common/exception';
import logger from '@/common/lib/logger';
import { getCurrencySymbol } from '@/common/utils/currency';

export interface ISettlementService {
  createSettlement(
    poolId: string,
    fromUserId: string,
    data: CreateSettlementDTO,
    proofFile: Express.Multer.File,
  ): Promise<ISettlementDTO>;
  listSettlements(poolId: string, userId: string): Promise<ISettlementDTO[]>;
  getSettlement(settlementId: string, userId: string): Promise<ISettlementDTO>;
  confirmSettlement(settlementId: string, userId: string): Promise<IGeneralResponse<null>>;
  disputeSettlement(
    settlementId: string,
    userId: string,
    data: DisputeSettlementDTO,
  ): Promise<IGeneralResponse<null>>;
}

@injectable()
class SettlementService implements ISettlementService {
  constructor(
    @inject('ISettlementRepository') private settlementRepository: ISettlementRepository,
    @inject('IPoolRepository') private poolRepository: IPoolRepository,
    @inject('IExpenseRepository') private expenseRepository: IExpenseRepository,
    @inject(WebhookDispatcher) private webhookDispatcher: WebhookDispatcher,
    @inject('IActivityRepository') private activityRepository: IActivityRepository,
    @inject(NotificationService) private notificationService: INotificationService,
  ) {}

  private logActivity(
    actorId: string,
    poolId: string,
    type: string,
    metadata: Record<string, unknown>,
  ): void {
    this.activityRepository
      .create({ id: uuidv4(), actorId, poolId, type, metadata })
      .catch((err: unknown) => logger.warn(`Failed to log activity (${type}): ${err}`));
  }

  async createSettlement(
    poolId: string,
    fromUserId: string,
    data: CreateSettlementDTO,
    proofFile: Express.Multer.File,
  ): Promise<ISettlementDTO> {
    logger.info(
      `Create settlement in pool ${poolId} from user ${fromUserId} to ${data.toUserId}, amount: ${data.amount}`,
    );
    try {
      const pool = await this.poolRepository.findById(poolId);
      if (!pool) {
        logger.warn(`Pool not found: ${poolId}`);
        throw new ResourceNotFoundException('Pool not found.');
      }

      const member = await this.poolRepository.getMember(poolId, fromUserId);
      if (!member) {
        logger.warn(`User ${fromUserId} is not a member of pool ${poolId}`);
        throw new ForbiddenException('You are not a member of this pool.');
      }

      const toMember = await this.poolRepository.getMember(poolId, data.toUserId);
      if (!toMember) {
        logger.warn(`Recipient ${data.toUserId} is not a member of pool ${poolId}`);
        throw new BadRequestException('Recipient is not a member of this pool.');
      }

      if (fromUserId === data.toUserId) {
        logger.warn(`User ${fromUserId} attempted to settle with themselves`);
        throw new BadRequestException('Cannot settle with yourself.');
      }

      // Upload proof (always store, parse is non-blocking)
      const proofPath = `settlements/${poolId}/${uuidv4()}-${proofFile.originalname}`;
      let proofUrl: string | null = null;
      try {
        logger.info(`Uploading settlement proof for pool ${poolId}`);
        proofUrl = await uploadFile('billbot', proofPath, proofFile.buffer, proofFile.mimetype);
        logger.info(`Settlement proof uploaded successfully`);
      } catch (err) {
        logger.warn(`Failed to upload settlement proof: ${err}`);
      }

      // Non-blocking AI parse of proof
      parseSettlementProof(proofFile.buffer, proofFile.mimetype).catch((err) =>
        logger.warn(`Settlement proof parse failed: ${err}`),
      );

      const settlement = await this.settlementRepository.create({
        id: uuidv4(),
        poolId,
        fromUser: fromUserId,
        toUser: data.toUserId,
        amount: data.amount.toString(),
        currency: 'NGN',
        proofUrl,
        note: data.note ?? null,
      });

      this.webhookDispatcher.dispatch(pool.groupId, 'settlement.submitted', {
        settlement_id: settlement.id,
        from_user: fromUserId,
        to_user: data.toUserId,
        amount: data.amount,
      });
      this.logActivity(fromUserId, poolId, 'settlement.submitted', {
        settlement_id: settlement.id,
        amount: data.amount.toString(),
        currency: 'NGN',
        to_user_id: data.toUserId,
      });

      // Notify the payee — they need to confirm or dispute
      this.notificationService
        .notify(
          data.toUserId,
          'settlement.submitted',
          'Payment awaiting confirmation',
          `You have a payment of ${getCurrencySymbol('NGN')}${data.amount} waiting for your confirmation.`,
          {
            action: 'confirm_settlement',
            settlement_id: settlement.id,
            pool_id: poolId,
            from_user: fromUserId,
            amount: data.amount.toString(),
          },
        )
        .catch(() => {});

      logger.info(`Settlement ${settlement.id} created in pool ${poolId}`);
      return this.mapToDTO(settlement);
    } catch (error) {
      if (
        error instanceof ResourceNotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      )
        throw error;
      logger.error(`Error creating settlement: ${error}`);
      throw new InternalServerException('Failed to create settlement.');
    }
  }

  async listSettlements(poolId: string, userId: string): Promise<ISettlementDTO[]> {
    logger.info(`Listing settlements for pool ${poolId}, requested by user ${userId}`);
    try {
      const member = await this.poolRepository.getMember(poolId, userId);
      if (!member) {
        logger.warn(`User ${userId} is not a member of pool ${poolId}`);
        throw new ForbiddenException('You are not a member of this pool.');
      }

      const settlements = await this.settlementRepository.findByPool(poolId);
      logger.info(`Found ${settlements.length} settlement(s) for pool ${poolId}`);
      return settlements.map((s) => this.mapToDTO(s));
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      logger.error(`Error listing settlements: ${error}`);
      throw new InternalServerException('Failed to list settlements.');
    }
  }

  async getSettlement(settlementId: string, userId: string): Promise<ISettlementDTO> {
    logger.info(`Fetching settlement ${settlementId}, requested by user ${userId}`);
    try {
      const settlement = await this.settlementRepository.findById(settlementId);
      if (!settlement) {
        logger.warn(`Settlement not found: ${settlementId}`);
        throw new ResourceNotFoundException('Settlement not found.');
      }

      if (settlement.poolId) {
        const member = await this.poolRepository.getMember(settlement.poolId, userId);
        if (!member) {
          logger.warn(
            `User ${userId} is not a member of pool ${settlement.poolId} — access denied`,
          );
          throw new ForbiddenException('Access denied.');
        }
      }

      logger.info(`Settlement ${settlementId} fetched successfully`);
      return this.mapToDTO(settlement);
    } catch (error) {
      if (error instanceof ResourceNotFoundException || error instanceof ForbiddenException)
        throw error;
      logger.error(`Error fetching settlement: ${error}`);
      throw new InternalServerException('Failed to fetch settlement.');
    }
  }

  async confirmSettlement(settlementId: string, userId: string): Promise<IGeneralResponse<null>> {
    logger.info(`Confirm settlement ${settlementId} requested by user ${userId}`);
    try {
      const settlement = await this.settlementRepository.findById(settlementId);
      if (!settlement) {
        logger.warn(`Settlement not found: ${settlementId}`);
        throw new ResourceNotFoundException('Settlement not found.');
      }

      if (settlement.toUser !== userId) {
        logger.warn(
          `User ${userId} is not the payee for settlement ${settlementId} — confirm denied`,
        );
        throw new ForbiddenException('Only the payee can confirm a settlement.');
      }

      if (settlement.status !== 'pending_verification') {
        logger.warn(`Settlement ${settlementId} is already ${settlement.status} — cannot confirm`);
        throw new BadRequestException(`Settlement is already ${settlement.status}.`);
      }

      await this.settlementRepository.update(settlementId, {
        status: 'settled',
        confirmedAt: new Date(),
      });

      // Mark splits as settled greedily
      if (settlement.poolId && settlement.fromUser && settlement.toUser) {
        logger.info(`Marking splits as settled for settlement ${settlementId}`);
        await this.markSplitsAsSettled(
          settlement.poolId,
          settlement.fromUser,
          settlement.toUser,
          parseFloat(settlement.amount),
        );

        const pool = await this.poolRepository.findById(settlement.poolId);
        if (pool) {
          this.webhookDispatcher.dispatch(pool.groupId, 'settlement.confirmed', {
            settlement_id: settlementId,
          });
        }
        this.logActivity(userId, settlement.poolId, 'settlement.confirmed', {
          settlement_id: settlementId,
          amount: settlement.amount,
          currency: settlement.currency,
          from_user_id: settlement.fromUser,
        });
      }

      // Auto-mark the payee's settlement.submitted notification as read
      this.notificationService
        .markReadByMeta(userId, 'settlement.submitted', { settlement_id: settlementId })
        .catch(() => {});

      logger.info(`Settlement ${settlementId} confirmed by user ${userId}`);
      return {
        success: true,
        message: 'Settlement confirmed. Splits marked as settled.',
        data: null,
      };
    } catch (error) {
      if (
        error instanceof ResourceNotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      )
        throw error;
      logger.error(`Error confirming settlement: ${error}`);
      throw new InternalServerException('Failed to confirm settlement.');
    }
  }

  async disputeSettlement(
    settlementId: string,
    userId: string,
    data: DisputeSettlementDTO,
  ): Promise<IGeneralResponse<null>> {
    logger.info(`Dispute settlement ${settlementId} requested by user ${userId}`);
    try {
      const settlement = await this.settlementRepository.findById(settlementId);
      if (!settlement) {
        logger.warn(`Settlement not found: ${settlementId}`);
        throw new ResourceNotFoundException('Settlement not found.');
      }

      if (settlement.toUser !== userId) {
        logger.warn(
          `User ${userId} is not the payee for settlement ${settlementId} — dispute denied`,
        );
        throw new ForbiddenException('Only the payee can dispute a settlement.');
      }

      if (settlement.status !== 'pending_verification') {
        logger.warn(`Settlement ${settlementId} is already ${settlement.status} — cannot dispute`);
        throw new BadRequestException(`Settlement is already ${settlement.status}.`);
      }

      await this.settlementRepository.update(settlementId, {
        status: 'disputed',
        disputedReason: data.reason,
      });

      if (settlement.poolId) {
        const pool = await this.poolRepository.findById(settlement.poolId);
        if (pool) {
          this.webhookDispatcher.dispatch(pool.groupId, 'settlement.disputed', {
            settlement_id: settlementId,
            reason: data.reason,
          });
        }
        this.logActivity(userId, settlement.poolId, 'settlement.disputed', {
          settlement_id: settlementId,
          reason: data.reason,
        });
      }

      // Auto-mark the payee's settlement.submitted notification as read
      this.notificationService
        .markReadByMeta(userId, 'settlement.submitted', { settlement_id: settlementId })
        .catch(() => {});

      // Notify the payer — their payment was rejected
      if (settlement.fromUser) {
        this.notificationService
          .notify(
            settlement.fromUser,
            'settlement.disputed',
            'Your payment was disputed',
            `Your payment has been disputed. Reason: ${data.reason}`,
            {
              action: 'view_dispute',
              settlement_id: settlementId,
              pool_id: settlement.poolId,
              reason: data.reason,
            },
          )
          .catch(() => {});
      }

      logger.info(`Settlement ${settlementId} disputed by user ${userId}`);
      return { success: true, message: 'Settlement disputed.', data: null };
    } catch (error) {
      if (
        error instanceof ResourceNotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      )
        throw error;
      logger.error(`Error disputing settlement: ${error}`);
      throw new InternalServerException('Failed to dispute settlement.');
    }
  }

  private mapToDTO(settlement: ISettlement): ISettlementDTO {
    return {
      id: settlement.id,
      pool_id: settlement.poolId,
      from_user: settlement.fromUser,
      to_user: settlement.toUser,
      amount: settlement.amount,
      currency: getCurrencySymbol(settlement.currency),
      proof_url: settlement.proofUrl,
      note: settlement.note,
      status: settlement.status,
      disputed_reason: settlement.disputedReason,
      confirmed_at: settlement.confirmedAt,
      created_at: settlement.createdAt,
    };
  }

  // Greedy split settlement: mark oldest unsettled splits first until amount is exhausted
  private async markSplitsAsSettled(
    poolId: string,
    fromUser: string,
    toUser: string,
    amount: number,
  ): Promise<void> {
    const splits = await this.expenseRepository.getUnsettledSplitsOwedBy(poolId, fromUser, toUser);
    let remaining = amount;

    for (const split of splits) {
      if (remaining <= 0) break;
      const splitAmount = parseFloat(split.amount);
      if (splitAmount <= remaining) {
        await this.expenseRepository.markSplitSettled(split.id);
        remaining -= splitAmount;
      }
    }
  }
}

export default SettlementService;
