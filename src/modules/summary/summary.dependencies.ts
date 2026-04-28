import express from 'express';
import { container } from 'tsyringe';
import SummaryService from './summary.service';
import {
  UserSummaryController,
  GroupSummaryController,
  PoolSummaryController,
} from './summary.controller';
import { ROUTER_TOKENS } from '@/common/constants/router.tokens';
import { registerMount } from '@/common/utils/route-registry';

export function registerSummaryDependencies(): void {
  container.register<express.Router>(ROUTER_TOKENS.USERS_SUMMARY, {
    useFactory: () => express.Router(),
  });
  container.register<express.Router>(ROUTER_TOKENS.GROUPS_SUMMARY, {
    useFactory: () => express.Router(),
  });
  container.register<express.Router>(ROUTER_TOKENS.POOLS_SUMMARY, {
    useFactory: () => express.Router(),
  });

  container.registerSingleton<SummaryService>(SummaryService);
  container.registerSingleton<UserSummaryController>(UserSummaryController);
  container.registerSingleton<GroupSummaryController>(GroupSummaryController);
  container.registerSingleton<PoolSummaryController>(PoolSummaryController);

  const userCtrl = container.resolve(UserSummaryController);
  registerMount('/users', userCtrl.getRouter());

  const groupCtrl = container.resolve(GroupSummaryController);
  registerMount('/groups', groupCtrl.getRouter());

  const poolCtrl = container.resolve(PoolSummaryController);
  registerMount('/pools', poolCtrl.getRouter());
}
