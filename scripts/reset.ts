import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { CONSTANTS } from '../src/common/configuration/constants';

const pool = new Pool({ connectionString: CONSTANTS.DATABASE_URL });
const db = drizzle(pool);

// eslint-disable-next-line no-console
const log = (msg: string) => console.log(`[reset] ${msg}`);

// Derrick is a real account — never delete him
const SEED_USER_IDS = [
  'seed-user-amaka-00002',
  'seed-user-tunde-00003',
  'seed-user-chidi-00004',
  'seed-user-ngozi-00005',
  'seed-user-emeka-00006',
];

const SEED_GROUP_IDS = [
  'seed-group-flatmates-01',
  'seed-group-office-00001',
  'seed-group-family-00001',
  'seed-group-friends-0001',
];

/**
 * Removes only the data inserted by the seed script.
 * Safe to run while other real data exists in the DB.
 */
async function resetSeedData() {
  log('Removing seed data...');

  // Delete in reverse dependency order — cascades handle children automatically
  // but we're explicit here so nothing is missed.

  await db.execute(sql`DELETE FROM notifications WHERE id LIKE 'seed-notif-%'`);
  log('  notifications cleared');

  await db.execute(sql`DELETE FROM activities WHERE id LIKE 'seed-act-%'`);
  log('  activities cleared');

  await db.execute(sql`
    DELETE FROM settlements WHERE id LIKE 'seed-settle-%'
  `);
  log('  settlements cleared');

  await db.execute(sql`
    DELETE FROM expense_splits WHERE id LIKE 'seed-split-%'
  `);
  log('  expense_splits cleared');

  await db.execute(sql`
    DELETE FROM expenses WHERE id LIKE 'seed-exp-%'
  `);
  log('  expenses cleared');

  await db.execute(sql`
    DELETE FROM pool_members
    WHERE pool_id LIKE 'seed-pool-%'
  `);
  log('  pool_members cleared');

  await db.execute(sql`
    DELETE FROM expense_pools WHERE id LIKE 'seed-pool-%'
  `);
  log('  expense_pools cleared');

  for (const gid of SEED_GROUP_IDS) {
    await db.execute(sql`DELETE FROM group_members WHERE group_id = ${gid}`);
    await db.execute(sql`DELETE FROM groups WHERE id = ${gid}`);
  }
  log('  group_members + groups cleared');

  for (const uid of SEED_USER_IDS) {
    await db.execute(sql`DELETE FROM sessions WHERE user_id = ${uid}`);
    await db.execute(sql`DELETE FROM users WHERE id = ${uid}`);
  }
  log('  sessions + users cleared');

  log('✅ Seed data removed.');
  await pool.end();
}

/**
 * Full wipe — clears ALL data in the database (non-destructive to schema).
 * Only use this in local dev.
 */
async function fullReset() {
  log('⚠️  Full reset — wiping all data...');

  await db.execute(sql`
    TRUNCATE TABLE
      settlements,
      expense_splits,
      expenses,
      pool_members,
      expense_pools,
      group_members,
      groups,
      sessions,
      notifications,
      activities,
      webhook_deliveries,
      webhook_subscriptions,
      invites,
      users
    RESTART IDENTITY CASCADE
  `);

  log('✅ All data cleared. Schema intact.');
  await pool.end();
}

const mode = process.argv[2];

if (mode === '--full') {
  fullReset().catch((e) => {
    console.error('[reset] Failed:', e);
    process.exit(1);
  });
} else {
  resetSeedData().catch((e) => {
    console.error('[reset] Failed:', e);
    process.exit(1);
  });
}
