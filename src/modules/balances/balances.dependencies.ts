import express from 'express';
import { container } from 'tsyringe';
import BalanceController, {
  BalanceSummaryController,
  BalanceGroupController,
} from './balances.controller';
import BalanceService from './balances.service';
import { ROUTER_TOKENS } from '@/common/constants/router.tokens';
import { registerMount } from '@/common/utils/route-registry';

export function registerBalanceDependencies(): void {
  container.register<express.Router>(ROUTER_TOKENS.BALANCES, {
    useFactory: () => express.Router(),
  });

  container.register<express.Router>(ROUTER_TOKENS.BALANCES_SUMMARY, {
    useFactory: () => express.Router(),
  });

  container.registerSingleton<BalanceService>(BalanceService);
  container.registerSingleton<BalanceController>(BalanceController);
  container.registerSingleton<BalanceSummaryController>(BalanceSummaryController);
  container.registerSingleton<BalanceGroupController>(BalanceGroupController);

  const poolCtrl = container.resolve(BalanceController);
  registerMount('/pools', poolCtrl.getRouter());

  const summaryCtrl = container.resolve(BalanceSummaryController);
  registerMount('/balances', summaryCtrl.getRouter());

  const groupCtrl = container.resolve(BalanceGroupController);
  registerMount('/groups', groupCtrl.getRouter());
}
