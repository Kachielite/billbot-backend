import express from 'express';
import { container } from 'tsyringe';
import GroupController from './groups.controller';
import GroupService from './groups.service';
import GroupRepositoryImpl from './groups.repository';
import { ROUTER_TOKENS } from '@/common/constants/router.tokens';
import { registerMount } from '@/common/utils/route-registry';

export function registerGroupDependencies(): void {
  container.register<express.Router>(ROUTER_TOKENS.GROUPS, {
    useFactory: () => express.Router(),
  });

  container.registerSingleton('IGroupRepository', GroupRepositoryImpl);
  container.registerSingleton<GroupService>(GroupService);
  container.registerSingleton<GroupController>(GroupController);

  const ctrl = container.resolve(GroupController);
  registerMount('/groups', ctrl.getRouter());
}
