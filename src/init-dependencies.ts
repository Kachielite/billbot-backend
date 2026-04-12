import 'reflect-metadata';
import express from 'express';
import { container } from 'tsyringe';
import Database from '@/common/lib/database';
import App from './app';
import { APP_TOKENS } from '@/common/constants/app.tokens';

// Module dependencies
import { registerAuthDependencies } from '@/modules/auth/auth.dependencies';
import { registerUserDependencies } from '@/modules/users/users.dependencies';
import { registerGroupDependencies } from '@/modules/groups/groups.dependencies';
import {
  registerWebhookDispatcher,
  registerWebhookDependencies,
} from '@/modules/webhooks/webhooks.dependencies';
import { registerInviteDependencies } from '@/modules/invites/invites.dependencies';
import { registerPoolDependencies } from '@/modules/pools/pools.dependencies';
import { registerExpenseDependencies } from '@/modules/expenses/expenses.dependencies';
import { registerBalanceDependencies } from '@/modules/balances/balances.dependencies';
import { registerSettlementDependencies } from '@/modules/settlements/settlements.dependencies';

export async function configureContainer(): Promise<void> {
  // Core singletons
  container.registerSingleton(Database);

  const db = container.resolve(Database);
  await db.migrate();

  container.registerInstance(APP_TOKENS.EXPRESS_APP, express());

  // Registration order matters — resolve the circular dep between webhooks and groups:
  // WebhookDispatcher has no group deps, but WebhookService needs IGroupRepository.
  // GroupService needs WebhookDispatcher. So: dispatcher first, groups second, full webhooks third.

  // 1. Webhook dispatcher only (no IGroupRepository dep)
  registerWebhookDispatcher();
  // 2. Users (IUserRepository needed by auth)
  registerUserDependencies();
  registerAuthDependencies();
  // 3. Groups (GroupService needs WebhookDispatcher, which is now registered)
  registerGroupDependencies();
  // 4. Full webhook module (WebhookService needs IGroupRepository, now registered)
  registerWebhookDependencies();
  // 5. Invites (needs IGroupRepository + WebhookDispatcher)
  registerInviteDependencies();
  // 6. Pools (needed by expenses, balances, settlements)
  registerPoolDependencies();
  // 7. Expenses (needed by balances, settlements)
  registerExpenseDependencies();
  // 8. Balances
  registerBalanceDependencies();
  // 9. Settlements
  registerSettlementDependencies();

  // App
  container.registerSingleton(App);
}
