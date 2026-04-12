import express from 'express';
import { container } from 'tsyringe';
import WebhookController from './webhooks.controller';
import WebhookService from './webhooks.service';
import WebhookRepositoryImpl from './webhooks.repository';
import { WebhookDispatcher } from './webhooks.dispatcher';
import { ROUTER_TOKENS } from '@/common/constants/router.tokens';
import { registerMount } from '@/common/utils/route-registry';

/**
 * Step 1 — register only the dispatcher (no dependency on IGroupRepository).
 * Must be called before any module that needs WebhookDispatcher (e.g. groups).
 */
export function registerWebhookDispatcher(): void {
  container.registerSingleton('IWebhookRepository', WebhookRepositoryImpl);
  container.registerSingleton<WebhookDispatcher>(WebhookDispatcher);
}

/**
 * Step 2 — register the full webhook module (WebhookService needs IGroupRepository).
 * Must be called after registerGroupDependencies().
 */
export function registerWebhookDependencies(): void {
  container.register<express.Router>(ROUTER_TOKENS.WEBHOOKS, {
    useFactory: () => express.Router(),
  });

  container.registerSingleton<WebhookService>(WebhookService);
  container.registerSingleton<WebhookController>(WebhookController);

  const ctrl = container.resolve(WebhookController);
  registerMount('/groups', ctrl.getRouter());
}
