import express from 'express';
import { container } from 'tsyringe';
import UserController from './users.controller';
import UserService from './users.service';
import UserRepositoryImpl from './users.repository';
import { ROUTER_TOKENS } from '@/common/constants/router.tokens';
import { registerMount } from '@/common/utils/route-registry';

export function registerUserDependencies(): void {
  container.register<express.Router>(ROUTER_TOKENS.USERS, {
    useFactory: () => express.Router(),
  });

  container.registerSingleton('IUserRepository', UserRepositoryImpl);
  container.registerSingleton<UserService>(UserService);
  container.registerSingleton<UserController>(UserController);

  const ctrl = container.resolve(UserController);
  registerMount('/users', ctrl.getRouter());
}
