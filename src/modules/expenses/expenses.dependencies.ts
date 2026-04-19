import express from 'express';
import { container } from 'tsyringe';
import ExpenseController from './expenses.controller';
import ExpenseGroupController from './expenses.group-controller';
import ExpenseService from './expenses.service';
import ExpenseRepositoryImpl from './expenses.repository';
import { RecurringExpenseScheduler } from './expenses.scheduler';
import { ROUTER_TOKENS } from '@/common/constants/router.tokens';
import { registerMount } from '@/common/utils/route-registry';

export function registerExpenseRepository(): void {
  container.registerSingleton('IExpenseRepository', ExpenseRepositoryImpl);
}

export function registerExpenseDependencies(): void {
  container.register<express.Router>(ROUTER_TOKENS.EXPENSES, {
    useFactory: () => express.Router(),
  });
  container.registerSingleton<ExpenseService>(ExpenseService);
  container.registerSingleton<RecurringExpenseScheduler>(RecurringExpenseScheduler);
  container.registerSingleton<ExpenseController>(ExpenseController);
  container.registerSingleton<ExpenseGroupController>(ExpenseGroupController);

  const ctrl = container.resolve(ExpenseController);
  registerMount('/pools', ctrl.getRouter());

  const groupCtrl = container.resolve(ExpenseGroupController);
  registerMount('/groups', groupCtrl.getRouter());
}

export function startRecurringExpenseScheduler(): void {
  container.resolve(RecurringExpenseScheduler).start();
}
