import express from 'express';
import { container } from 'tsyringe';
import BalanceController from './balances.controller';
import BalanceService from './balances.service';
import { ROUTER_TOKENS } from '@/common/constants/router.tokens';
import { registerMount } from '@/common/utils/route-registry';

export function registerBalanceDependencies(): void {
  container.register<express.Router>(ROUTER_TOKENS.BALANCES, {
    useFactory: () => express.Router(),
  });

  container.registerSingleton<BalanceService>(BalanceService);
  container.registerSingleton<BalanceController>(BalanceController);

  const ctrl = container.resolve(BalanceController);
  registerMount('/pools', ctrl.getRouter());
}
