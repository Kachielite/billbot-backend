import { inject, injectable } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';
import { ISettlementRepository } from './settlements.repository';
import { ISettlement } from './settlements.interface';
import { CreateSettlementDTO, DisputeSettlementDTO } from './settlements.dto';
import { IGeneralResponse } from '@/common/types/interface';
import { IPoolRepository } from '@/modules/pools/pools.repository';
import { IExpenseRepository } from '@/modules/expenses/expenses.repository';
import { WebhookDispatcher } from '@/modules/webhooks/webhooks.dispatcher';
import { uploadFile } from '@/common/lib/storage';
import { parseSettlementProof } from '@/common/lib/ai-parser';
import {
  BadRequestException,
  ForbiddenException,
  InternalServerException,
  ResourceNotFoundException,
} from '@/common/exception';
import logger from '@/common/lib/logger';

export interface ISettlementService {
  createSettlement(
    poolId: string,
    fromUserId: string,
    data: CreateSettlementDTO,
    proofFile: Express.Multer.File,
  ): Promise<ISettlement>;
  listSettlements(poolId: string, userId: string): Promise<ISettlement[]>;
  getSettlement(settlementId: string, userId: string): Promise<ISettlement>;
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
  ) {}

  async createSettlement(
    poolId: string,
    fromUserId: string,
    data: CreateSettlementDTO,
    proofFile: Express.Multer.File,
  ): Promise<ISettlement> {
    try {
      const pool = await this.poolRepository.findById(poolId);
      if (!pool) throw new ResourceNotFoundException('Pool not found.');

      const member = await this.poolRepository.getMember(poolId, fromUserId);
      if (!member) throw new ForbiddenException('You are not a member of this pool.');

      const toMember = await this.poolRepository.getMember(poolId, data.toUserId);
      if (!toMember) throw new BadRequestException('Recipient is not a member of this pool.');

      if (fromUserId === data.toUserId) {
        throw new BadRequestException('Cannot settle with yourself.');
      }

      // Upload proof (always store, parse is non-blocking)
      const proofPath = `settlements/${poolId}/${uuidv4()}-${proofFile.originalname}`;
      let proofUrl: string | null = null;
      try {
        proofUrl = await uploadFile('billbot', proofPath, proofFile.buffer, proofFile.mimetype);
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

      return settlement;
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

  async listSettlements(poolId: string, userId: string): Promise<ISettlement[]> {
    try {
      const member = await this.poolRepository.getMember(poolId, userId);
      if (!member) throw new ForbiddenException('You are not a member of this pool.');

      return this.settlementRepository.findByPool(poolId);
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      logger.error(`Error listing settlements: ${error}`);
      throw new InternalServerException('Failed to list settlements.');
    }
  }

  async getSettlement(settlementId: string, userId: string): Promise<ISettlement> {
    try {
      const settlement = await this.settlementRepository.findById(settlementId);
      if (!settlement) throw new ResourceNotFoundException('Settlement not found.');

      if (settlement.poolId) {
        const member = await this.poolRepository.getMember(settlement.poolId, userId);
        if (!member) throw new ForbiddenException('Access denied.');
      }

      return settlement;
    } catch (error) {
      if (error instanceof ResourceNotFoundException || error instanceof ForbiddenException)
        throw error;
      logger.error(`Error fetching settlement: ${error}`);
      throw new InternalServerException('Failed to fetch settlement.');
    }
  }

  async confirmSettlement(settlementId: string, userId: string): Promise<IGeneralResponse<null>> {
    try {
      const settlement = await this.settlementRepository.findById(settlementId);
      if (!settlement) throw new ResourceNotFoundException('Settlement not found.');

      if (settlement.toUser !== userId) {
        throw new ForbiddenException('Only the payee can confirm a settlement.');
      }

      if (settlement.status !== 'pending_verification') {
        throw new BadRequestException(`Settlement is already ${settlement.status}.`);
      }

      await this.settlementRepository.update(settlementId, {
        status: 'settled',
        confirmedAt: new Date(),
      });

      // Mark splits as settled greedily
      if (settlement.poolId && settlement.fromUser && settlement.toUser) {
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
      }

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
    try {
      const settlement = await this.settlementRepository.findById(settlementId);
      if (!settlement) throw new ResourceNotFoundException('Settlement not found.');

      if (settlement.toUser !== userId) {
        throw new ForbiddenException('Only the payee can dispute a settlement.');
      }

      if (settlement.status !== 'pending_verification') {
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
      }

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
