import { inject, injectable } from 'tsyringe';
import { ICategoryRepository } from './categories.repository';
import { ICategory } from './categories.interface';
import { SEEDED_CATEGORIES } from './categories.seeder';
import { InternalServerException, ResourceNotFoundException } from '@/common/exception';
import logger from '@/common/lib/logger';

export interface ICategoryService {
  listCategories(): Promise<ICategory[]>;
  getCategory(id: string): Promise<ICategory>;
  /** Run once at startup — inserts seed data if the table is empty. */
  seedIfEmpty(): Promise<void>;
}

@injectable()
class CategoryService implements ICategoryService {
  constructor(@inject('ICategoryRepository') private categoryRepository: ICategoryRepository) {}

  async listCategories(): Promise<ICategory[]> {
    logger.info('Fetching all categories');
    try {
      const categories = await this.categoryRepository.findAll();
      logger.info(`Found ${categories.length} category/categories`);
      return categories;
    } catch (error) {
      logger.error(`Error listing categories: ${error}`);
      throw new InternalServerException('Failed to list categories.');
    }
  }

  async getCategory(id: string): Promise<ICategory> {
    logger.info(`Fetching category ${id}`);
    try {
      const category = await this.categoryRepository.findById(id);
      if (!category) {
        logger.warn(`Category not found: ${id}`);
        throw new ResourceNotFoundException('Category not found.');
      }
      logger.info(`Category ${id} fetched successfully`);
      return category;
    } catch (error) {
      if (error instanceof ResourceNotFoundException) throw error;
      logger.error(`Error fetching category: ${error}`);
      throw new InternalServerException('Failed to fetch category.');
    }
  }

  async seedIfEmpty(): Promise<void> {
    try {
      const count = await this.categoryRepository.count();
      if (count > 0) {
        logger.info(`Categories already seeded (${count} records). Skipping.`);
        return;
      }
      await this.categoryRepository.insertMany(SEEDED_CATEGORIES);
      logger.info(`Seeded ${SEEDED_CATEGORIES.length} categories.`);
    } catch (error) {
      logger.error(`Category seeding failed: ${error}`);
      throw error;
    }
  }
}

export default CategoryService;
