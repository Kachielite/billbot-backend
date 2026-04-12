import express from 'express';
import { container } from 'tsyringe';
import CategoryController from './categories.controller';
import CategoryService from './categories.service';
import CategoryRepositoryImpl from './categories.repository';
import { ROUTER_TOKENS } from '@/common/constants/router.tokens';
import { registerMount } from '@/common/utils/route-registry';

export function registerCategoryDependencies(): void {
  container.register<express.Router>(ROUTER_TOKENS.CATEGORIES, {
    useFactory: () => express.Router(),
  });

  container.registerSingleton('ICategoryRepository', CategoryRepositoryImpl);
  container.registerSingleton<CategoryService>(CategoryService);
  container.registerSingleton<CategoryController>(CategoryController);

  const ctrl = container.resolve(CategoryController);
  registerMount('/categories', ctrl.getRouter());
}

export async function seedCategories(): Promise<void> {
  await container.resolve(CategoryService).seedIfEmpty();
}
