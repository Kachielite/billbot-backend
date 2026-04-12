import express from 'express';
import { container } from 'tsyringe';
import ExpenseController from './expenses.controller';
import ExpenseService from './expenses.service';
import ExpenseRepositoryImpl from './expenses.repository';
import { RecurringExpenseScheduler } from './expenses.scheduler';
import { ROUTER_TOKENS } from '@/common/constants/router.tokens';
import { registerMount } from '@/common/utils/route-registry';

export function registerExpenseDependencies(): void {
  container.register<express.Router>(ROUTER_TOKENS.EXPENSES, {
    useFactory: () => express.Router(),
  });

  container.registerSingleton('IExpenseRepository', ExpenseRepositoryImpl);
  container.registerSingleton<ExpenseService>(ExpenseService);
  container.registerSingleton<RecurringExpenseScheduler>(RecurringExpenseScheduler);
  container.registerSingleton<ExpenseController>(ExpenseController);

  const ctrl = container.resolve(ExpenseController);
  registerMount('/pools', ctrl.getRouter());
}

export function startRecurringExpenseScheduler(): void {
  container.resolve(RecurringExpenseScheduler).start();
}
