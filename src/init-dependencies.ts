import 'reflect-metadata';
import express from 'express';
import { container } from 'tsyringe';
import Database from '@/common/lib/database';
import App from './app';
import { APP_TOKENS } from '@/common/constants/app.tokens';

// Module dependencies
import { registerAuthDependencies } from '@/modules/auth/auth.dependencies';
import {
  registerUserRepository,
  registerUserDependencies,
} from '@/modules/users/users.dependencies';
import {
  registerGroupRepository,
  registerGroupDependencies,
} from '@/modules/groups/groups.dependencies';
import {
  registerWebhookDispatcher,
  registerWebhookDependencies,
} from '@/modules/webhooks/webhooks.dependencies';
import { registerInviteDependencies } from '@/modules/invites/invites.dependencies';
import { registerPoolDependencies } from '@/modules/pools/pools.dependencies';
import {
  registerExpenseRepository,
  registerExpenseDependencies,
  startRecurringExpenseScheduler,
} from '@/modules/expenses/expenses.dependencies';
import { registerBalanceDependencies } from '@/modules/balances/balances.dependencies';
import { registerSettlementDependencies } from '@/modules/settlements/settlements.dependencies';
import {
  registerCategoryDependencies,
  seedCategories,
} from '@/modules/categories/categories.dependencies';
import { registerNotificationDependencies } from '@/modules/notifications/notifications.dependencies';
import { registerActivityDependencies } from '@/modules/activities/activities.dependencies';

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
  // 2. Users repository + service early (IUserRepository needed by auth; controller deferred)
  registerUserRepository();
  registerAuthDependencies();
  // 3. Group repository only — other modules (webhooks, invites, pools) inject IGroupRepository
  registerGroupRepository();
  // 4. Full webhook module (WebhookService needs IGroupRepository, now registered)
  registerWebhookDependencies();
  // 5. Notifications (needed by invites and other modules for in-app notifications)
  registerNotificationDependencies();
  // 6. Invites (needs IGroupRepository + WebhookDispatcher + NotificationService)
  registerInviteDependencies();
  // 7. Activities (IActivityRepository needed by pools, expenses, settlements)
  registerActivityDependencies();
  // 8. Expense repository only — PoolService needs IExpenseRepository for activity_status
  registerExpenseRepository();
  // 9. Pools (needed by expenses, balances, settlements)
  registerPoolDependencies();
  // 10. Categories (needed by expenses for FK validation)
  registerCategoryDependencies();
  // 11. Expenses service + controllers (needs ICategoryRepository + IActivityRepository)
  registerExpenseDependencies();
  // 12. Groups service + controller (GroupService needs IExpenseRepository + IPoolRepository)
  registerGroupDependencies();
  // 13. User controller (UserController needs IExpenseService + ActivityService)
  registerUserDependencies();
  // 14. Balances
  registerBalanceDependencies();
  // 15. Settlements (needs IActivityRepository)
  registerSettlementDependencies();

  // Seed reference data (idempotent — skips if already populated)
  await seedCategories();

  // Start background schedulers (after all deps are registered)
  startRecurringExpenseScheduler();

  // App
  container.registerSingleton(App);
}
