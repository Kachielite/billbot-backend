import express from 'express';
import { container } from 'tsyringe';
import SettlementController from './settlements.controller';
import SettlementPoolController from './settlements.pool-controller';
import SettlementService from './settlements.service';
import SettlementRepositoryImpl from './settlements.repository';
import { ROUTER_TOKENS } from '@/common/constants/router.tokens';
import { registerMount } from '@/common/utils/route-registry';

export function registerSettlementDependencies(): void {
  container.register<express.Router>(ROUTER_TOKENS.SETTLEMENTS, {
    useFactory: () => express.Router(),
  });

  container.registerSingleton('ISettlementRepository', SettlementRepositoryImpl);
  container.registerSingleton<SettlementService>(SettlementService);
  container.registerSingleton<SettlementController>(SettlementController);
  container.registerSingleton<SettlementPoolController>(SettlementPoolController);

  const ctrl = container.resolve(SettlementController);
  registerMount('/settlements', ctrl.getRouter());

  const poolCtrl = container.resolve(SettlementPoolController);
  registerMount('/pools', poolCtrl.getRouter());
}
