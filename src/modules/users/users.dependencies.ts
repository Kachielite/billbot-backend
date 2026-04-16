import express from 'express';
import { container } from 'tsyringe';
import UserController from './users.controller';
import UserService from './users.service';
import UserRepositoryImpl from './users.repository';
import { ROUTER_TOKENS } from '@/common/constants/router.tokens';
import { registerMount } from '@/common/utils/route-registry';

// Step 1 — register repository and service early (other modules may need IUserRepository)
export function registerUserRepository(): void {
  container.register<express.Router>(ROUTER_TOKENS.USERS, {
    useFactory: () => express.Router(),
  });
  container.registerSingleton('IUserRepository', UserRepositoryImpl);
  container.registerSingleton<UserService>(UserService);
}

// Step 2 — resolve controller after IExpenseService is registered
export function registerUserDependencies(): void {
  container.registerSingleton<UserController>(UserController);
  const ctrl = container.resolve(UserController);
  registerMount('/users', ctrl.getRouter());
}
