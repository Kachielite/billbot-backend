import express from 'express';
import { container } from 'tsyringe';
import PoolController from './pools.controller';
import PoolGroupController from './pools.group-controller';
import PoolService from './pools.service';
import PoolRepositoryImpl from './pools.repository';
import { ROUTER_TOKENS } from '@/common/constants/router.tokens';
import { registerMount } from '@/common/utils/route-registry';

export function registerPoolDependencies(): void {
  container.register<express.Router>(ROUTER_TOKENS.POOLS, {
    useFactory: () => express.Router(),
  });

  container.registerSingleton('IPoolRepository', PoolRepositoryImpl);
  container.registerSingleton<PoolService>(PoolService);
  container.registerSingleton<PoolController>(PoolController);
  container.registerSingleton<PoolGroupController>(PoolGroupController);

  const ctrl = container.resolve(PoolController);
  registerMount('/pools', ctrl.getRouter());

  const groupCtrl = container.resolve(PoolGroupController);
  registerMount('/groups', groupCtrl.getRouter());
}
