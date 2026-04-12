import { inject, injectable } from 'tsyringe';
import express, { Request } from 'express';
import { BaseController, Controller, Get, Post } from '@/common/decorators/controller.decorator';
import { ROUTER_TOKENS } from '@/common/constants/router.tokens';
import SettlementService, { ISettlementService } from './settlements.service';
import { DisputeSettlementSchema, DisputeSettlementDTO } from './settlements.dto';
import { IAuthenticatedRequest } from '@/common/types/interface';

/**
 * @swagger
 * tags:
 *   name: Settlements
 *   description: Manual payment settlement with proof of payment
 */

@injectable()
@Controller('/settlements')
class SettlementController extends BaseController {
  constructor(
    @inject(ROUTER_TOKENS.SETTLEMENTS) router: express.Router,
    @inject(SettlementService) private readonly settlementService: ISettlementService,
  ) {
    super(router);
  }

  /**
   * @swagger
   * /settlements/{settlementId}:
   *   get:
   *     tags: [Settlements]
   *     summary: Get settlement detail
   *     description: Returns settlement including proof image URL
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: settlementId
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       '200':
   *         description: Settlement detail
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 id: { type: string }
   *                 pool_id: { type: string, nullable: true }
   *                 from_user: { type: string, nullable: true }
   *                 to_user: { type: string, nullable: true }
   *                 amount: { type: string, example: '5000.00' }
   *                 currency: { type: string, example: NGN }
   *                 proof_url: { type: string, nullable: true }
   *                 note: { type: string, nullable: true }
   *                 status: { type: string, enum: [pending_verification, settled, disputed] }
   *                 disputed_reason: { type: string, nullable: true }
   *                 confirmed_at: { type: string, format: date-time, nullable: true }
   *                 created_at: { type: string, format: date-time }
   *       '403':
   *         $ref: '#/components/responses/Forbidden'
   *       '404':
   *         $ref: '#/components/responses/NotFound'
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Get('/:settlementId')
  async getSettlement(req: Request) {
    const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    return this.settlementService.getSettlement(req.params['settlementId'] as string, userId);
  }

  /**
   * @swagger
   * /settlements/{settlementId}/confirm:
   *   post:
   *     tags: [Settlements]
   *     summary: Confirm a settlement (payee only)
   *     description: |
   *       Must be the recipient (to_user). Marks settlement as 'settled' and greedily clears
   *       matching expense splits (oldest first until amount is exhausted).
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: settlementId
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       '200':
   *         description: Settlement confirmed
   *       '400':
   *         $ref: '#/components/responses/BadRequest'
   *       '403':
   *         $ref: '#/components/responses/Forbidden'
   *       '404':
   *         $ref: '#/components/responses/NotFound'
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Post('/:settlementId/confirm')
  async confirmSettlement(req: Request) {
    const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    return this.settlementService.confirmSettlement(req.params['settlementId'] as string, userId);
  }

  /**
   * @swagger
   * /settlements/{settlementId}/dispute:
   *   post:
   *     tags: [Settlements]
   *     summary: Dispute a settlement (payee only)
   *     description: |
   *       Must be the recipient (to_user). Marks settlement as 'disputed'.
   *       A disputed settlement does not block new settlements.
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: settlementId
   *         required: true
   *         schema: { type: string }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [reason]
   *             properties:
   *               reason: { type: string, maxLength: 500 }
   *     responses:
   *       '200':
   *         description: Settlement disputed
   *       '400':
   *         $ref: '#/components/responses/BadRequest'
   *       '403':
   *         $ref: '#/components/responses/Forbidden'
   *       '404':
   *         $ref: '#/components/responses/NotFound'
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Post('/:settlementId/dispute', { validate: DisputeSettlementSchema })
  async disputeSettlement(req: Request) {
    const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    const payload = req.body as DisputeSettlementDTO;
    return this.settlementService.disputeSettlement(
      req.params['settlementId'] as string,
      userId,
      payload,
    );
  }
}

export default SettlementController;
