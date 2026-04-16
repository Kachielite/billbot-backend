import express from 'express';
import { container } from 'tsyringe';
import GroupController from './groups.controller';
import GroupService from './groups.service';
import GroupRepositoryImpl from './groups.repository';
import { ROUTER_TOKENS } from '@/common/constants/router.tokens';
import { registerMount } from '@/common/utils/route-registry';

/**
 * Register the repository and router token early — other modules (webhooks, invites, pools)
 * inject IGroupRepository and/or ROUTER_TOKENS.GROUPS before GroupService is ready.
 */
export function registerGroupRepository(): void {
  container.register<express.Router>(ROUTER_TOKENS.GROUPS, {
    useFactory: () => express.Router(),
  });
  container.registerSingleton('IGroupRepository', GroupRepositoryImpl);
}

/** Register the service and controller — called after IExpenseRepository is available. */
export function registerGroupDependencies(): void {
  container.registerSingleton<GroupService>(GroupService);
  container.registerSingleton<GroupController>(GroupController);

  const ctrl = container.resolve(GroupController);
  registerMount('/groups', ctrl.getRouter());
}
