import { inject, injectable } from 'tsyringe';
import express, { Request } from 'express';
import { BaseController, Controller, Get } from '@/common/decorators/controller.decorator';
import { ROUTER_TOKENS } from '@/common/constants/router.tokens';
import CategoryService, { ICategoryService } from './categories.service';

/**
 * @swagger
 * tags:
 *   name: Categories
 *   description: Predefined expense categories
 */

@injectable()
@Controller('/categories')
class CategoryController extends BaseController {
  constructor(
    @inject(ROUTER_TOKENS.CATEGORIES) router: express.Router,
    @inject(CategoryService) private readonly categoryService: ICategoryService,
  ) {
    super(router);
  }

  /**
   * @swagger
   * /categories:
   *   get:
   *     tags: [Categories]
   *     summary: List all expense categories
   *     description: |
   *       Returns the full set of predefined expense categories grouped by type.
   *       Use `id` when creating or updating an expense's `categoryId`.
   *       The `group` field is the analytics bucket (housing, food, health, etc.).
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       '200':
   *         description: Category list
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   id: { type: string }
   *                   slug: { type: string, example: school_fees }
   *                   name: { type: string, example: School Fees & Tuition }
   *                   description: { type: string }
   *                   emoji: { type: string, example: 🎓 }
   *                   group: { type: string, example: education }
   *                   is_active: { type: boolean }
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Get('/')
  async listCategories(_req: Request) {
    return this.categoryService.listCategories();
  }

  /**
   * @swagger
   * /categories/{categoryId}:
   *   get:
   *     tags: [Categories]
   *     summary: Get a single category
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: categoryId
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       '200':
   *         description: Category detail
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 id: { type: string }
   *                 slug: { type: string }
   *                 name: { type: string }
   *                 description: { type: string }
   *                 emoji: { type: string }
   *                 group: { type: string }
   *                 is_active: { type: boolean }
   *       '404':
   *         $ref: '#/components/responses/NotFound'
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Get('/:categoryId')
  async getCategory(req: Request) {
    return this.categoryService.getCategory(req.params['categoryId'] as string);
  }
}

export default CategoryController;
