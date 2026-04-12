import express from 'express';
import { container } from 'tsyringe';
import NotificationController from './notifications.controller';
import NotificationService from './notifications.service';
import NotificationRepositoryImpl from './notifications.repository';
import { ROUTER_TOKENS } from '@/common/constants/router.tokens';
import { registerMount } from '@/common/utils/route-registry';

export function registerNotificationDependencies(): void {
  container.register<express.Router>(ROUTER_TOKENS.NOTIFICATIONS, {
    useFactory: () => express.Router(),
  });

  container.registerSingleton('INotificationRepository', NotificationRepositoryImpl);
  container.registerSingleton<NotificationService>(NotificationService);
  container.registerSingleton<NotificationController>(NotificationController);

  const ctrl = container.resolve(NotificationController);
  registerMount('/notifications', ctrl.getRouter());
}
