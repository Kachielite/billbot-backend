import { inject, injectable } from 'tsyringe';
import express, { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { BaseController, Controller, Get, Post } from '@/common/decorators/controller.decorator';
import { ROUTER_TOKENS } from '@/common/constants/router.tokens';
import SettlementService, { ISettlementService } from './settlements.service';
import { CreateSettlementSchema, CreateSettlementDTO } from './settlements.dto';
import { IAuthenticatedRequest } from '@/common/types/interface';
import { BadRequestException } from '@/common/exception';
import { validateImageMagicBytes } from '@/common/utils/file-validator';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
    }
  },
});

/**
 * @swagger
 * tags:
 *   name: Settlements
 */

@injectable()
@Controller('/pools')
class SettlementPoolController extends BaseController {
  constructor(
    @inject(ROUTER_TOKENS.POOLS) router: express.Router,
    @inject(SettlementService) private readonly settlementService: ISettlementService,
  ) {
    super(router);
  }

  /**
   * @swagger
   * /pools/{poolId}/settlements:
   *   post:
   *     tags: [Settlements]
   *     summary: Submit a settlement with proof of payment
   *     description: |
   *       Payer uploads proof of bank transfer. Creates settlement with status 'pending_verification'.
   *       Proof image is stored on Supabase Storage. AI parses the proof non-blockingly.
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: poolId
   *         required: true
   *         schema: { type: string }
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             required: [toUserId, amount, proof]
   *             properties:
   *               toUserId: { type: string, format: uuid }
   *               amount: { type: number }
   *               proof: { type: string, format: binary, description: Screenshot of transfer confirmation }
   *               note: { type: string }
   *     responses:
   *       '201':
   *         description: Settlement submitted
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 id: { type: string }
   *                 status: { type: string, example: pending_verification }
   *                 proof_url: { type: string }
   *       '400':
   *         $ref: '#/components/responses/BadRequest'
   *       '403':
   *         $ref: '#/components/responses/Forbidden'
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Post('/:poolId/settlements', { statusCode: 201 })
  async createSettlement(req: Request, res: Response, next: NextFunction) {
    upload.single('proof')(req, res, async (err) => {
      if (err) return next(new BadRequestException(err.message));
      if (!req.file) return next(new BadRequestException('Proof of payment image is required.'));
      if (!validateImageMagicBytes(req.file.buffer, req.file.mimetype)) {
        return next(new BadRequestException('File content does not match the declared type.'));
      }

      try {
        const parsed = CreateSettlementSchema.safeParse({
          ...req.body,
          amount: Number(req.body.amount),
        });
        if (!parsed.success) {
          return next(
            new BadRequestException(parsed.error.errors[0]?.message || 'Validation failed'),
          );
        }

        const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
        const result = await this.settlementService.createSettlement(
          req.params['poolId'] as string,
          userId,
          parsed.data as CreateSettlementDTO,
          req.file,
        );
        res.status(201).json(result);
      } catch (e) {
        next(e);
      }
    });
  }

  /**
   * @swagger
   * /pools/{poolId}/settlements:
   *   get:
   *     tags: [Settlements]
   *     summary: List settlements in a pool
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: poolId
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       '200':
   *         description: Settlement list with statuses
   *       '403':
   *         $ref: '#/components/responses/Forbidden'
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Get('/:poolId/settlements')
  async listSettlements(req: Request) {
    const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    return this.settlementService.listSettlements(req.params['poolId'] as string, userId);
  }
}

export default SettlementPoolController;
