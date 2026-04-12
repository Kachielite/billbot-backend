import express from 'express';
import { container } from 'tsyringe';
import InviteController from './invites.controller';
import InviteService from './invites.service';
import InviteRepositoryImpl from './invites.repository';
import { ROUTER_TOKENS } from '@/common/constants/router.tokens';
import { registerMount } from '@/common/utils/route-registry';

export function registerInviteDependencies(): void {
  container.register<express.Router>(ROUTER_TOKENS.INVITES, {
    useFactory: () => express.Router(),
  });

  container.registerSingleton('IInviteRepository', InviteRepositoryImpl);
  container.registerSingleton<InviteService>(InviteService);
  container.registerSingleton<InviteController>(InviteController);

  const ctrl = container.resolve(InviteController);
  registerMount('/groups', ctrl.getRouter());
}
