import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { CONSTANTS } from '../src/common/configuration/constants';
import { sql } from 'drizzle-orm';
import { SEEDED_CATEGORIES } from '../src/modules/categories/categories.seeder';

if (CONSTANTS.NODE_ENV === 'production') {
  // eslint-disable-next-line no-console
  console.error('[seed] Refusing to run seed script in production.');
  process.exit(1);
}

const pool = new Pool({ connectionString: CONSTANTS.DATABASE_URL });
const db = drizzle(pool);

// ─── Category IDs (must match categories.seeder.ts CATEGORY_IDS) ─────────────

const CAT = {
  rent: '4f0be298-11b6-4383-9d0e-7b94a04d4d0c',
  electricity: '1c562531-0dc1-48b0-b7aa-739a2c598f94',
  generator: 'cb877430-dd04-4e95-9b76-f242088685a9',
  internet: '3491f942-c84e-45e9-940f-d6fdcd992ade',
  gas: 'fecd2617-b902-4686-b0b9-df4ecb44fbd1',
  groceries: '766fe975-2529-46e6-9433-3e9cfae9bb30',
  eating_out: '33573929-6ede-4dee-8062-03656f376042',
  fuel: '71e41b99-5916-4d1f-b814-aadab72ef5e8',
  entertainment: '71bf8dca-13c5-4462-8305-bcb9348b9f41',
  travel: '275d1ae0-8cdb-47ff-b83d-eabdb31e3364',
  family_support: '6a6c71d1-176c-4a76-b54d-7c07ffada998',
  pharmacy: '8204f239-2b31-4231-a219-706e65af3bd7',
  events: 'dbfe01f9-c3bd-4dc8-b755-c17f60733c8b',
  clothing: '2211c61e-a89e-4c0a-9ab1-19c506bcf2cf',
};

// ─── Fixed IDs (stable across re-runs) ───────────────────────────────────────

const USERS = {
  // Real account — not inserted by seed, already exists in DB
  derrick: {
    id: 'a25079d9-01cf-49ce-a9e0-e40bb27eb812',
    name: 'Derrick Madumere',
    email: 'derrick.onyekachi@gmail.com',
    phone: null,
  },
  amaka: {
    id: 'seed-user-amaka-00002',
    name: 'Amaka Obi',
    email: 'amaka@billbot.app',
    phone: '+2348000000002',
  },
  tunde: {
    id: 'seed-user-tunde-00003',
    name: 'Tunde Adeyemi',
    email: 'tunde@billbot.app',
    phone: '+2348000000003',
  },
  chidi: {
    id: 'seed-user-chidi-00004',
    name: 'Chidi Eze',
    email: 'chidi@billbot.app',
    phone: '+2348000000004',
  },
  ngozi: {
    id: 'seed-user-ngozi-00005',
    name: 'Ngozi Madumere',
    email: 'ngozi@billbot.app',
    phone: '+2348000000005',
  },
  emeka: {
    id: 'seed-user-emeka-00006',
    name: 'Emeka Okafor',
    email: 'emeka@billbot.app',
    phone: '+2348000000006',
  },
};

const GROUPS = {
  flatmates: {
    id: 'seed-group-flatmates-01',
    name: 'Lekki Flatmates',
    description: 'Monthly shared house bills',
    emoji: '🏠',
    color: '#4F46E5',
    inviteCode: 'FLATM8S001',
  },
  office: {
    id: 'seed-group-office-00001',
    name: 'Office Crew',
    description: 'Lunch and team hangouts',
    emoji: '💼',
    color: '#059669',
    inviteCode: 'OFFICECR001',
  },
  family: {
    id: 'seed-group-family-00001',
    name: 'Family',
    description: 'Family contributions and projects',
    emoji: '👨‍👩‍👧',
    color: '#DC2626',
    inviteCode: 'FAMILY0001',
  },
  friends: {
    id: 'seed-group-friends-0001',
    name: 'Friends',
    description: 'Hangouts, trips and good times',
    emoji: '🎉',
    color: '#D97706',
    inviteCode: 'FRIENDS001',
  },
};

const POOLS = {
  monthlyBills: {
    id: 'seed-pool-monthly-00001',
    groupId: GROUPS.flatmates.id,
    name: 'Monthly Bills',
    isDefault: true,
  },
  groceries: {
    id: 'seed-pool-grocery-00001',
    groupId: GROUPS.flatmates.id,
    name: 'Kitchen & Groceries',
    isDefault: false,
  },
  lunch: {
    id: 'seed-pool-lunch-0000001',
    groupId: GROUPS.office.id,
    name: 'Lunch Pool',
    isDefault: true,
  },
  teamOutings: {
    id: 'seed-pool-outing-000001',
    groupId: GROUPS.office.id,
    name: 'Team Outings',
    isDefault: false,
  },
  familyUpkeep: {
    id: 'seed-pool-fam-upkeep-01',
    groupId: GROUPS.family.id,
    name: 'Monthly Upkeep',
    isDefault: true,
  },
  familyEvents: {
    id: 'seed-pool-fam-events-01',
    groupId: GROUPS.family.id,
    name: 'Events & Celebrations',
    isDefault: false,
  },
  friendsHangouts: {
    id: 'seed-pool-frnd-hang-001',
    groupId: GROUPS.friends.id,
    name: 'Hangouts',
    isDefault: true,
  },
  friendsTrip: {
    id: 'seed-pool-frnd-trip-001',
    groupId: GROUPS.friends.id,
    name: 'Ibadan Trip',
    isDefault: false,
  },
};

// eslint-disable-next-line no-console
const log = (msg: string) => console.log(`[seed] ${msg}`);

async function seed() {
  log('Starting seed...');

  // ─── Categories ────────────────────────────────────────────────────────────
  log('Inserting categories...');
  await db.execute(sql`DELETE FROM categories`);
  for (const c of SEEDED_CATEGORIES) {
    await db.execute(sql`
      INSERT INTO categories (id, slug, name, description, emoji, "group", is_active)
      VALUES (${c.id}, ${c.slug}, ${c.name}, ${c.description}, ${c.emoji}, ${c.group}, ${c.isActive})
      ON CONFLICT (id) DO NOTHING
    `);
  }

  // ─── Users (skip Derrick — he already exists as a real account) ───────────
  log('Inserting seed users...');
  const seedOnlyUsers = [USERS.amaka, USERS.tunde, USERS.chidi, USERS.ngozi, USERS.emeka];
  for (const u of seedOnlyUsers) {
    await db.execute(sql`
      INSERT INTO users (id, name, email, phone, created_at)
      VALUES (${u.id}, ${u.name}, ${u.email}, ${u.phone}, NOW())
      ON CONFLICT (id) DO NOTHING
    `);
  }

  // ─── Sessions for seed users only (Derrick uses his real Google session) ───
  log('Inserting sessions for seed users...');
  for (const u of seedOnlyUsers) {
    const token = `billbot_seed_${u.id}`;
    await db.execute(sql`
      INSERT INTO sessions (id, user_id, token, expires_at, created_at)
      VALUES (${`sess-${u.id}`}, ${u.id}, ${token}, NOW() + INTERVAL '30 days', NOW())
      ON CONFLICT (id) DO NOTHING
    `);
  }

  // ─── Groups ────────────────────────────────────────────────────────────────
  log('Inserting groups...');
  for (const g of Object.values(GROUPS)) {
    await db.execute(sql`
      INSERT INTO groups (id, name, description, emoji, color, invite_code, created_by, created_at)
      VALUES (${g.id}, ${g.name}, ${g.description}, ${g.emoji}, ${g.color}, ${g.inviteCode}, ${USERS.derrick.id}, NOW())
      ON CONFLICT (id) DO NOTHING
    `);
  }

  // ─── Group Members ─────────────────────────────────────────────────────────
  log('Inserting group members...');
  const allMembers = [
    { groupId: GROUPS.flatmates.id, userId: USERS.derrick.id, role: 'admin' },
    { groupId: GROUPS.flatmates.id, userId: USERS.amaka.id, role: 'member' },
    { groupId: GROUPS.flatmates.id, userId: USERS.tunde.id, role: 'member' },
    { groupId: GROUPS.office.id, userId: USERS.derrick.id, role: 'admin' },
    { groupId: GROUPS.office.id, userId: USERS.chidi.id, role: 'member' },
    { groupId: GROUPS.office.id, userId: USERS.tunde.id, role: 'member' },
    { groupId: GROUPS.family.id, userId: USERS.derrick.id, role: 'admin' },
    { groupId: GROUPS.family.id, userId: USERS.ngozi.id, role: 'member' },
    { groupId: GROUPS.family.id, userId: USERS.emeka.id, role: 'member' },
    { groupId: GROUPS.family.id, userId: USERS.amaka.id, role: 'member' },
    { groupId: GROUPS.friends.id, userId: USERS.derrick.id, role: 'admin' },
    { groupId: GROUPS.friends.id, userId: USERS.tunde.id, role: 'member' },
    { groupId: GROUPS.friends.id, userId: USERS.chidi.id, role: 'member' },
    { groupId: GROUPS.friends.id, userId: USERS.emeka.id, role: 'member' },
  ];
  for (const m of allMembers) {
    await db.execute(sql`
      INSERT INTO group_members (group_id, user_id, role, joined_at)
      VALUES (${m.groupId}, ${m.userId}, ${m.role}, NOW())
      ON CONFLICT DO NOTHING
    `);
  }

  // ─── Pools ─────────────────────────────────────────────────────────────────
  log('Inserting pools...');
  const poolRows = [
    { ...POOLS.monthlyBills, createdBy: USERS.derrick.id },
    { ...POOLS.groceries, createdBy: USERS.derrick.id },
    { ...POOLS.lunch, createdBy: USERS.derrick.id },
    { ...POOLS.teamOutings, createdBy: USERS.derrick.id },
    { ...POOLS.familyUpkeep, createdBy: USERS.derrick.id },
    { ...POOLS.familyEvents, createdBy: USERS.derrick.id },
    { ...POOLS.friendsHangouts, createdBy: USERS.derrick.id },
    { ...POOLS.friendsTrip, createdBy: USERS.derrick.id },
  ];
  for (const p of poolRows) {
    await db.execute(sql`
      INSERT INTO expense_pools (id, group_id, name, status, split_type, is_default, created_by, created_at)
      VALUES (${p.id}, ${p.groupId}, ${p.name}, 'active', 'equal', ${p.isDefault}, ${p.createdBy}, NOW())
      ON CONFLICT (id) DO NOTHING
    `);
  }

  // ─── Pool Members ──────────────────────────────────────────────────────────
  log('Inserting pool members...');
  const poolMembers = [
    { poolId: POOLS.monthlyBills.id, userId: USERS.derrick.id },
    { poolId: POOLS.monthlyBills.id, userId: USERS.amaka.id },
    { poolId: POOLS.monthlyBills.id, userId: USERS.tunde.id },
    { poolId: POOLS.groceries.id, userId: USERS.derrick.id },
    { poolId: POOLS.groceries.id, userId: USERS.amaka.id },
    { poolId: POOLS.groceries.id, userId: USERS.tunde.id },
    { poolId: POOLS.lunch.id, userId: USERS.derrick.id },
    { poolId: POOLS.lunch.id, userId: USERS.chidi.id },
    { poolId: POOLS.lunch.id, userId: USERS.tunde.id },
    { poolId: POOLS.teamOutings.id, userId: USERS.derrick.id },
    { poolId: POOLS.teamOutings.id, userId: USERS.chidi.id },
    { poolId: POOLS.teamOutings.id, userId: USERS.tunde.id },
    { poolId: POOLS.familyUpkeep.id, userId: USERS.derrick.id },
    { poolId: POOLS.familyUpkeep.id, userId: USERS.ngozi.id },
    { poolId: POOLS.familyUpkeep.id, userId: USERS.emeka.id },
    { poolId: POOLS.familyUpkeep.id, userId: USERS.amaka.id },
    { poolId: POOLS.familyEvents.id, userId: USERS.derrick.id },
    { poolId: POOLS.familyEvents.id, userId: USERS.ngozi.id },
    { poolId: POOLS.familyEvents.id, userId: USERS.emeka.id },
    { poolId: POOLS.familyEvents.id, userId: USERS.amaka.id },
    { poolId: POOLS.friendsHangouts.id, userId: USERS.derrick.id },
    { poolId: POOLS.friendsHangouts.id, userId: USERS.tunde.id },
    { poolId: POOLS.friendsHangouts.id, userId: USERS.chidi.id },
    { poolId: POOLS.friendsHangouts.id, userId: USERS.emeka.id },
    { poolId: POOLS.friendsTrip.id, userId: USERS.derrick.id },
    { poolId: POOLS.friendsTrip.id, userId: USERS.tunde.id },
    { poolId: POOLS.friendsTrip.id, userId: USERS.chidi.id },
    { poolId: POOLS.friendsTrip.id, userId: USERS.emeka.id },
  ];
  for (const pm of poolMembers) {
    await db.execute(sql`
      INSERT INTO pool_members (pool_id, user_id, joined_at)
      VALUES (${pm.poolId}, ${pm.userId}, NOW())
      ON CONFLICT DO NOTHING
    `);
  }

  // ─── Expenses & Splits ─────────────────────────────────────────────────────
  log('Inserting expenses and splits...');

  type SplitInput = { id: string; owedBy: string; amount: number; settled: boolean };
  type ExpenseInput = {
    id: string;
    poolId: string;
    paidBy: string;
    amount: number;
    description: string;
    categoryId?: string;
    isRecurring?: boolean;
    recurrenceFrequency?: string;
    nextOccurrenceAt?: string;
    createdAt?: string;
    splits: SplitInput[];
  };

  const expenses: ExpenseInput[] = [
    // ── Monthly Bills — past expenses ──────────────────────────────────────
    {
      id: 'seed-exp-rent-000001',
      poolId: POOLS.monthlyBills.id,
      paidBy: USERS.derrick.id,
      amount: 300000,
      description: 'April Rent',
      categoryId: CAT.rent,
      createdAt: '2026-04-01',
      splits: [
        { id: 'seed-split-rent-d01', owedBy: USERS.derrick.id, amount: 100000, settled: true },
        { id: 'seed-split-rent-a01', owedBy: USERS.amaka.id, amount: 100000, settled: true },
        { id: 'seed-split-rent-t01', owedBy: USERS.tunde.id, amount: 100000, settled: false },
      ],
    },
    {
      id: 'seed-exp-elec-000001',
      poolId: POOLS.monthlyBills.id,
      paidBy: USERS.amaka.id,
      amount: 45000,
      description: 'NEPA token — April',
      categoryId: CAT.electricity,
      createdAt: '2026-04-03',
      splits: [
        { id: 'seed-split-elec-d01', owedBy: USERS.derrick.id, amount: 15000, settled: true },
        { id: 'seed-split-elec-a01', owedBy: USERS.amaka.id, amount: 15000, settled: true },
        { id: 'seed-split-elec-t01', owedBy: USERS.tunde.id, amount: 15000, settled: false },
      ],
    },
    {
      id: 'seed-exp-gen-0000001',
      poolId: POOLS.monthlyBills.id,
      paidBy: USERS.derrick.id,
      amount: 24000,
      description: 'Generator diesel — 2 weeks',
      categoryId: CAT.generator,
      createdAt: '2026-04-10',
      splits: [
        { id: 'seed-split-gen-d01', owedBy: USERS.derrick.id, amount: 8000, settled: true },
        { id: 'seed-split-gen-a01', owedBy: USERS.amaka.id, amount: 8000, settled: false },
        { id: 'seed-split-gen-t01', owedBy: USERS.tunde.id, amount: 8000, settled: false },
      ],
    },
    // ── Monthly Bills — recurring upcoming expenses ─────────────────────────
    {
      id: 'seed-exp-wifi-000001',
      poolId: POOLS.monthlyBills.id,
      paidBy: USERS.tunde.id,
      amount: 30000,
      description: 'Spectranet Wi-Fi subscription',
      categoryId: CAT.internet,
      createdAt: '2026-04-05',
      isRecurring: true,
      recurrenceFrequency: 'monthly',
      nextOccurrenceAt: '2026-05-05',
      splits: [
        { id: 'seed-split-wifi-d01', owedBy: USERS.derrick.id, amount: 10000, settled: false },
        { id: 'seed-split-wifi-a01', owedBy: USERS.amaka.id, amount: 10000, settled: false },
        { id: 'seed-split-wifi-t01', owedBy: USERS.tunde.id, amount: 10000, settled: true },
      ],
    },
    {
      id: 'seed-exp-rent-000002',
      poolId: POOLS.monthlyBills.id,
      paidBy: USERS.derrick.id,
      amount: 300000,
      description: 'Monthly Rent',
      categoryId: CAT.rent,
      createdAt: '2026-03-01',
      isRecurring: true,
      recurrenceFrequency: 'monthly',
      nextOccurrenceAt: '2026-05-01',
      splits: [
        { id: 'seed-split-rent2-d01', owedBy: USERS.derrick.id, amount: 100000, settled: true },
        { id: 'seed-split-rent2-a01', owedBy: USERS.amaka.id, amount: 100000, settled: true },
        { id: 'seed-split-rent2-t01', owedBy: USERS.tunde.id, amount: 100000, settled: true },
      ],
    },
    // ── Groceries pool ─────────────────────────────────────────────────────
    {
      id: 'seed-exp-groc-000001',
      poolId: POOLS.groceries.id,
      paidBy: USERS.amaka.id,
      amount: 36000,
      description: 'Market run — Shoprite',
      categoryId: CAT.groceries,
      createdAt: '2026-04-08',
      splits: [
        { id: 'seed-split-groc-d01', owedBy: USERS.derrick.id, amount: 12000, settled: false },
        { id: 'seed-split-groc-a01', owedBy: USERS.amaka.id, amount: 12000, settled: true },
        { id: 'seed-split-groc-t01', owedBy: USERS.tunde.id, amount: 12000, settled: false },
      ],
    },
    {
      id: 'seed-exp-groc-000002',
      poolId: POOLS.groceries.id,
      paidBy: USERS.tunde.id,
      amount: 18000,
      description: 'Cooking gas refill',
      categoryId: CAT.gas,
      createdAt: '2026-04-15',
      splits: [
        { id: 'seed-split-groc2-d01', owedBy: USERS.derrick.id, amount: 6000, settled: false },
        { id: 'seed-split-groc2-a01', owedBy: USERS.amaka.id, amount: 6000, settled: false },
        { id: 'seed-split-groc2-t01', owedBy: USERS.tunde.id, amount: 6000, settled: true },
      ],
    },
    {
      id: 'seed-exp-groc-000003',
      poolId: POOLS.groceries.id,
      paidBy: USERS.derrick.id,
      amount: 12000,
      description: 'Seasoning & toiletries — Jumia',
      categoryId: CAT.groceries,
      createdAt: '2026-04-20',
      isRecurring: true,
      recurrenceFrequency: 'weekly',
      nextOccurrenceAt: '2026-04-27',
      splits: [
        { id: 'seed-split-groc3-d01', owedBy: USERS.derrick.id, amount: 4000, settled: true },
        { id: 'seed-split-groc3-a01', owedBy: USERS.amaka.id, amount: 4000, settled: false },
        { id: 'seed-split-groc3-t01', owedBy: USERS.tunde.id, amount: 4000, settled: false },
      ],
    },
    // ── Lunch pool ─────────────────────────────────────────────────────────
    {
      id: 'seed-exp-lnch-000001',
      poolId: POOLS.lunch.id,
      paidBy: USERS.derrick.id,
      amount: 15000,
      description: 'Buka lunch — Monday',
      categoryId: CAT.eating_out,
      createdAt: '2026-04-07',
      splits: [
        { id: 'seed-split-lnch-d01', owedBy: USERS.derrick.id, amount: 5000, settled: true },
        { id: 'seed-split-lnch-c01', owedBy: USERS.chidi.id, amount: 5000, settled: true },
        { id: 'seed-split-lnch-t01', owedBy: USERS.tunde.id, amount: 5000, settled: true },
      ],
    },
    {
      id: 'seed-exp-lnch-000002',
      poolId: POOLS.lunch.id,
      paidBy: USERS.chidi.id,
      amount: 21000,
      description: 'Mr. Biggs — team lunch',
      categoryId: CAT.eating_out,
      createdAt: '2026-04-14',
      splits: [
        { id: 'seed-split-lnch2-d01', owedBy: USERS.derrick.id, amount: 7000, settled: false },
        { id: 'seed-split-lnch2-c01', owedBy: USERS.chidi.id, amount: 7000, settled: true },
        { id: 'seed-split-lnch2-t01', owedBy: USERS.tunde.id, amount: 7000, settled: false },
      ],
    },
    {
      id: 'seed-exp-lnch-000003',
      poolId: POOLS.lunch.id,
      paidBy: USERS.tunde.id,
      amount: 12000,
      description: 'Shawarma run',
      categoryId: CAT.eating_out,
      createdAt: '2026-04-21',
      splits: [
        { id: 'seed-split-lnch3-d01', owedBy: USERS.derrick.id, amount: 4000, settled: false },
        { id: 'seed-split-lnch3-c01', owedBy: USERS.chidi.id, amount: 4000, settled: false },
        { id: 'seed-split-lnch3-t01', owedBy: USERS.tunde.id, amount: 4000, settled: true },
      ],
    },
    // Recurring lunch order
    {
      id: 'seed-exp-lnch-000004',
      poolId: POOLS.lunch.id,
      paidBy: USERS.derrick.id,
      amount: 18000,
      description: 'Weekly lunch order',
      categoryId: CAT.eating_out,
      createdAt: '2026-04-16',
      isRecurring: true,
      recurrenceFrequency: 'weekly',
      nextOccurrenceAt: '2026-04-30',
      splits: [
        { id: 'seed-split-lnch4-d01', owedBy: USERS.derrick.id, amount: 6000, settled: true },
        { id: 'seed-split-lnch4-c01', owedBy: USERS.chidi.id, amount: 6000, settled: true },
        { id: 'seed-split-lnch4-t01', owedBy: USERS.tunde.id, amount: 6000, settled: true },
      ],
    },
    // ── Family Upkeep pool ─────────────────────────────────────────────────
    {
      id: 'seed-exp-fam-up-00001',
      poolId: POOLS.familyUpkeep.id,
      paidBy: USERS.derrick.id,
      amount: 80000,
      description: "Mum's monthly upkeep — April",
      categoryId: CAT.family_support,
      createdAt: '2026-04-01',
      isRecurring: true,
      recurrenceFrequency: 'monthly',
      nextOccurrenceAt: '2026-05-01',
      splits: [
        { id: 'seed-split-fup-d01', owedBy: USERS.derrick.id, amount: 20000, settled: true },
        { id: 'seed-split-fup-n01', owedBy: USERS.ngozi.id, amount: 20000, settled: true },
        { id: 'seed-split-fup-e01', owedBy: USERS.emeka.id, amount: 20000, settled: false },
        { id: 'seed-split-fup-a01', owedBy: USERS.amaka.id, amount: 20000, settled: false },
      ],
    },
    {
      id: 'seed-exp-fam-up-00002',
      poolId: POOLS.familyUpkeep.id,
      paidBy: USERS.ngozi.id,
      amount: 35000,
      description: "Dad's medication — April",
      categoryId: CAT.pharmacy,
      createdAt: '2026-04-10',
      splits: [
        { id: 'seed-split-fup2-d01', owedBy: USERS.derrick.id, amount: 8750, settled: true },
        { id: 'seed-split-fup2-n01', owedBy: USERS.ngozi.id, amount: 8750, settled: true },
        { id: 'seed-split-fup2-e01', owedBy: USERS.emeka.id, amount: 8750, settled: false },
        { id: 'seed-split-fup2-a01', owedBy: USERS.amaka.id, amount: 8750, settled: false },
      ],
    },
    {
      id: 'seed-exp-fam-up-00003',
      poolId: POOLS.familyUpkeep.id,
      paidBy: USERS.emeka.id,
      amount: 50000,
      description: 'Generator fuel & repairs — compound',
      categoryId: CAT.generator,
      createdAt: '2026-04-17',
      splits: [
        { id: 'seed-split-fup3-d01', owedBy: USERS.derrick.id, amount: 12500, settled: false },
        { id: 'seed-split-fup3-n01', owedBy: USERS.ngozi.id, amount: 12500, settled: false },
        { id: 'seed-split-fup3-e01', owedBy: USERS.emeka.id, amount: 12500, settled: true },
        { id: 'seed-split-fup3-a01', owedBy: USERS.amaka.id, amount: 12500, settled: false },
      ],
    },
    // ── Family Events pool ─────────────────────────────────────────────────
    {
      id: 'seed-exp-fam-ev-00001',
      poolId: POOLS.familyEvents.id,
      paidBy: USERS.derrick.id,
      amount: 150000,
      description: "Mum's 60th birthday — hall & catering deposit",
      categoryId: CAT.events,
      createdAt: '2026-04-05',
      splits: [
        { id: 'seed-split-fev-d01', owedBy: USERS.derrick.id, amount: 37500, settled: true },
        { id: 'seed-split-fev-n01', owedBy: USERS.ngozi.id, amount: 37500, settled: true },
        { id: 'seed-split-fev-e01', owedBy: USERS.emeka.id, amount: 37500, settled: false },
        { id: 'seed-split-fev-a01', owedBy: USERS.amaka.id, amount: 37500, settled: false },
      ],
    },
    {
      id: 'seed-exp-fam-ev-00002',
      poolId: POOLS.familyEvents.id,
      paidBy: USERS.amaka.id,
      amount: 45000,
      description: 'Aso-ebi fabric — 3 pieces',
      categoryId: CAT.clothing,
      createdAt: '2026-04-14',
      splits: [
        { id: 'seed-split-fev2-d01', owedBy: USERS.derrick.id, amount: 15000, settled: false },
        { id: 'seed-split-fev2-n01', owedBy: USERS.ngozi.id, amount: 15000, settled: true },
        { id: 'seed-split-fev2-e01', owedBy: USERS.emeka.id, amount: 15000, settled: false },
      ],
    },
    // ── Friends Hangouts pool ──────────────────────────────────────────────
    {
      id: 'seed-exp-frnd-hg-0001',
      poolId: POOLS.friendsHangouts.id,
      paidBy: USERS.derrick.id,
      amount: 60000,
      description: 'Cubana nightout — bottles & entry',
      categoryId: CAT.entertainment,
      createdAt: '2026-04-06',
      splits: [
        { id: 'seed-split-fhg-d01', owedBy: USERS.derrick.id, amount: 15000, settled: true },
        { id: 'seed-split-fhg-t01', owedBy: USERS.tunde.id, amount: 15000, settled: true },
        { id: 'seed-split-fhg-c01', owedBy: USERS.chidi.id, amount: 15000, settled: false },
        { id: 'seed-split-fhg-e01', owedBy: USERS.emeka.id, amount: 15000, settled: false },
      ],
    },
    {
      id: 'seed-exp-frnd-hg-0002',
      poolId: POOLS.friendsHangouts.id,
      paidBy: USERS.tunde.id,
      amount: 28000,
      description: 'Cinema + popcorn — Imax Lagos',
      categoryId: CAT.entertainment,
      createdAt: '2026-04-13',
      splits: [
        { id: 'seed-split-fhg2-d01', owedBy: USERS.derrick.id, amount: 7000, settled: false },
        { id: 'seed-split-fhg2-t01', owedBy: USERS.tunde.id, amount: 7000, settled: true },
        { id: 'seed-split-fhg2-c01', owedBy: USERS.chidi.id, amount: 7000, settled: false },
        { id: 'seed-split-fhg2-e01', owedBy: USERS.emeka.id, amount: 7000, settled: false },
      ],
    },
    {
      id: 'seed-exp-frnd-hg-0003',
      poolId: POOLS.friendsHangouts.id,
      paidBy: USERS.chidi.id,
      amount: 20000,
      description: "Sunday jollof + drinks — Emeka's place",
      categoryId: CAT.eating_out,
      createdAt: '2026-04-20',
      splits: [
        { id: 'seed-split-fhg3-d01', owedBy: USERS.derrick.id, amount: 5000, settled: false },
        { id: 'seed-split-fhg3-t01', owedBy: USERS.tunde.id, amount: 5000, settled: false },
        { id: 'seed-split-fhg3-c01', owedBy: USERS.chidi.id, amount: 5000, settled: true },
        { id: 'seed-split-fhg3-e01', owedBy: USERS.emeka.id, amount: 5000, settled: false },
      ],
    },
    // ── Friends Trip pool ──────────────────────────────────────────────────
    {
      id: 'seed-exp-frnd-tr-0001',
      poolId: POOLS.friendsTrip.id,
      paidBy: USERS.derrick.id,
      amount: 120000,
      description: 'Airbnb — Ibadan 3 nights',
      categoryId: CAT.travel,
      createdAt: '2026-04-08',
      splits: [
        { id: 'seed-split-ftr-d01', owedBy: USERS.derrick.id, amount: 30000, settled: true },
        { id: 'seed-split-ftr-t01', owedBy: USERS.tunde.id, amount: 30000, settled: true },
        { id: 'seed-split-ftr-c01', owedBy: USERS.chidi.id, amount: 30000, settled: false },
        { id: 'seed-split-ftr-e01', owedBy: USERS.emeka.id, amount: 30000, settled: false },
      ],
    },
    {
      id: 'seed-exp-frnd-tr-0002',
      poolId: POOLS.friendsTrip.id,
      paidBy: USERS.emeka.id,
      amount: 56000,
      description: 'Fuel & tolls — Lagos–Ibadan highway',
      categoryId: CAT.fuel,
      createdAt: '2026-04-09',
      splits: [
        { id: 'seed-split-ftr2-d01', owedBy: USERS.derrick.id, amount: 14000, settled: false },
        { id: 'seed-split-ftr2-t01', owedBy: USERS.tunde.id, amount: 14000, settled: false },
        { id: 'seed-split-ftr2-c01', owedBy: USERS.chidi.id, amount: 14000, settled: false },
        { id: 'seed-split-ftr2-e01', owedBy: USERS.emeka.id, amount: 14000, settled: true },
      ],
    },
    {
      id: 'seed-exp-frnd-tr-0003',
      poolId: POOLS.friendsTrip.id,
      paidBy: USERS.tunde.id,
      amount: 44000,
      description: 'Groceries & drinks for the trip',
      categoryId: CAT.groceries,
      createdAt: '2026-04-09',
      isRecurring: false,
      splits: [
        { id: 'seed-split-ftr3-d01', owedBy: USERS.derrick.id, amount: 11000, settled: false },
        { id: 'seed-split-ftr3-t01', owedBy: USERS.tunde.id, amount: 11000, settled: true },
        { id: 'seed-split-ftr3-c01', owedBy: USERS.chidi.id, amount: 11000, settled: false },
        { id: 'seed-split-ftr3-e01', owedBy: USERS.emeka.id, amount: 11000, settled: false },
      ],
    },
    // ── Team Outings pool ──────────────────────────────────────────────────
    {
      id: 'seed-exp-out-0000001',
      poolId: POOLS.teamOutings.id,
      paidBy: USERS.derrick.id,
      amount: 90000,
      description: 'Escape room + dinner — team outing',
      categoryId: CAT.entertainment,
      createdAt: '2026-04-12',
      splits: [
        { id: 'seed-split-out-d01', owedBy: USERS.derrick.id, amount: 30000, settled: true },
        { id: 'seed-split-out-c01', owedBy: USERS.chidi.id, amount: 30000, settled: false },
        { id: 'seed-split-out-t01', owedBy: USERS.tunde.id, amount: 30000, settled: false },
      ],
    },
    {
      id: 'seed-exp-out-0000002',
      poolId: POOLS.teamOutings.id,
      paidBy: USERS.chidi.id,
      amount: 45000,
      description: 'Go-karting — Friday fun',
      categoryId: CAT.entertainment,
      createdAt: '2026-04-18',
      splits: [
        { id: 'seed-split-out2-d01', owedBy: USERS.derrick.id, amount: 15000, settled: false },
        { id: 'seed-split-out2-c01', owedBy: USERS.chidi.id, amount: 15000, settled: true },
        { id: 'seed-split-out2-t01', owedBy: USERS.tunde.id, amount: 15000, settled: false },
      ],
    },
  ];

  for (const exp of expenses) {
    const createdAt = exp.createdAt ? new Date(exp.createdAt) : new Date();
    const nextOcc = exp.nextOccurrenceAt ? new Date(exp.nextOccurrenceAt) : null;

    await db.execute(sql`
      INSERT INTO expenses (
        id, pool_id, paid_by, amount, currency, description, category_id,
        is_recurring, recurrence_frequency, next_occurrence_at, created_at
      )
      VALUES (
        ${exp.id}, ${exp.poolId}, ${exp.paidBy}, ${exp.amount}, 'NGN', ${exp.description},
        ${exp.categoryId ?? null},
        ${exp.isRecurring ?? false}, ${exp.recurrenceFrequency ?? null}, ${nextOcc}, ${createdAt}
      )
      ON CONFLICT (id) DO NOTHING
    `);

    for (const s of exp.splits) {
      await db.execute(sql`
        INSERT INTO expense_splits (id, expense_id, owed_by, amount, settled, settled_at)
        VALUES (
          ${s.id}, ${exp.id}, ${s.owedBy}, ${s.amount}, ${s.settled},
          ${s.settled ? sql`NOW()` : sql`NULL`}
        )
        ON CONFLICT (id) DO NOTHING
      `);
    }
  }

  // ─── Settlements ───────────────────────────────────────────────────────────
  log('Inserting settlements...');
  const settlements = [
    {
      id: 'seed-settle-0000001',
      poolId: POOLS.monthlyBills.id,
      fromUser: USERS.amaka.id,
      toUser: USERS.derrick.id,
      amount: 100000,
      note: 'Rent payment — April',
      status: 'settled',
      createdAt: '2026-04-02',
    },
    {
      id: 'seed-settle-0000002',
      poolId: POOLS.monthlyBills.id,
      fromUser: USERS.tunde.id,
      toUser: USERS.amaka.id,
      amount: 15000,
      note: 'NEPA April',
      status: 'pending_verification',
      createdAt: '2026-04-22',
    },
    {
      id: 'seed-settle-0000003',
      poolId: POOLS.lunch.id,
      fromUser: USERS.chidi.id,
      toUser: USERS.derrick.id,
      amount: 5000,
      note: 'Monday lunch',
      status: 'settled',
      createdAt: '2026-04-09',
    },
    {
      id: 'seed-settle-0000004',
      poolId: POOLS.teamOutings.id,
      fromUser: USERS.tunde.id,
      toUser: USERS.derrick.id,
      amount: 30000,
      note: 'Escape room split',
      status: 'disputed',
      createdAt: '2026-04-20',
    },
    {
      id: 'seed-settle-0000005',
      poolId: POOLS.groceries.id,
      fromUser: USERS.amaka.id,
      toUser: USERS.tunde.id,
      amount: 6000,
      note: 'Gas refill share',
      status: 'pending_verification',
      createdAt: '2026-04-21',
    },
    // Family
    {
      id: 'seed-settle-0000006',
      poolId: POOLS.familyUpkeep.id,
      fromUser: USERS.ngozi.id,
      toUser: USERS.derrick.id,
      amount: 20000,
      note: 'Mum upkeep — April share',
      status: 'settled',
      createdAt: '2026-04-03',
    },
    {
      id: 'seed-settle-0000007',
      poolId: POOLS.familyEvents.id,
      fromUser: USERS.ngozi.id,
      toUser: USERS.derrick.id,
      amount: 37500,
      note: 'Birthday hall deposit share',
      status: 'settled',
      createdAt: '2026-04-06',
    },
    {
      id: 'seed-settle-0000008',
      poolId: POOLS.familyUpkeep.id,
      fromUser: USERS.emeka.id,
      toUser: USERS.derrick.id,
      amount: 20000,
      note: 'Mum upkeep — overdue',
      status: 'pending_verification',
      createdAt: '2026-04-22',
    },
    // Friends
    {
      id: 'seed-settle-0000009',
      poolId: POOLS.friendsTrip.id,
      fromUser: USERS.tunde.id,
      toUser: USERS.derrick.id,
      amount: 30000,
      note: 'Airbnb share — Ibadan trip',
      status: 'settled',
      createdAt: '2026-04-11',
    },
    {
      id: 'seed-settle-0000010',
      poolId: POOLS.friendsHangouts.id,
      fromUser: USERS.chidi.id,
      toUser: USERS.derrick.id,
      amount: 15000,
      note: 'Cubana share',
      status: 'pending_verification',
      createdAt: '2026-04-19',
    },
    {
      id: 'seed-settle-0000011',
      poolId: POOLS.friendsHangouts.id,
      fromUser: USERS.emeka.id,
      toUser: USERS.derrick.id,
      amount: 15000,
      note: 'Cubana share',
      status: 'disputed',
      createdAt: '2026-04-21',
    },
  ];

  for (const s of settlements) {
    await db.execute(sql`
      INSERT INTO settlements (id, pool_id, from_user, to_user, amount, currency, note, status, confirmed_at, created_at)
      VALUES (
        ${s.id}, ${s.poolId}, ${s.fromUser}, ${s.toUser}, ${s.amount}, 'NGN', ${s.note}, ${s.status},
        ${s.status === 'settled' ? sql`${new Date(s.createdAt)}` : sql`NULL`},
        ${new Date(s.createdAt)}
      )
      ON CONFLICT (id) DO NOTHING
    `);
  }

  // ─── Activities ────────────────────────────────────────────────────────────
  log('Inserting activities...');
  const activities = [
    {
      id: 'seed-act-00000001',
      actorId: USERS.derrick.id,
      poolId: POOLS.monthlyBills.id,
      type: 'expense.created',
      createdAt: '2026-04-01',
      metadata: {
        expense_id: 'seed-exp-rent-000001',
        amount: 300000,
        currency: 'NGN',
        description: 'April Rent',
      },
    },
    {
      id: 'seed-act-00000002',
      actorId: USERS.amaka.id,
      poolId: POOLS.monthlyBills.id,
      type: 'expense.created',
      createdAt: '2026-04-03',
      metadata: {
        expense_id: 'seed-exp-elec-000001',
        amount: 45000,
        currency: 'NGN',
        description: 'NEPA token — April',
      },
    },
    {
      id: 'seed-act-00000003',
      actorId: USERS.amaka.id,
      poolId: POOLS.monthlyBills.id,
      type: 'settlement.submitted',
      createdAt: '2026-04-02',
      metadata: {
        settlement_id: 'seed-settle-0000001',
        amount: 100000,
        currency: 'NGN',
        to_user_id: USERS.derrick.id,
      },
    },
    {
      id: 'seed-act-00000004',
      actorId: USERS.derrick.id,
      poolId: POOLS.monthlyBills.id,
      type: 'settlement.confirmed',
      createdAt: '2026-04-02',
      metadata: {
        settlement_id: 'seed-settle-0000001',
        amount: 100000,
        currency: 'NGN',
        from_user_id: USERS.amaka.id,
      },
    },
    {
      id: 'seed-act-00000005',
      actorId: USERS.derrick.id,
      poolId: POOLS.monthlyBills.id,
      type: 'expense.created',
      createdAt: '2026-04-10',
      metadata: {
        expense_id: 'seed-exp-gen-0000001',
        amount: 24000,
        currency: 'NGN',
        description: 'Generator diesel — 2 weeks',
      },
    },
    {
      id: 'seed-act-00000006',
      actorId: USERS.amaka.id,
      poolId: POOLS.groceries.id,
      type: 'expense.created',
      createdAt: '2026-04-08',
      metadata: {
        expense_id: 'seed-exp-groc-000001',
        amount: 36000,
        currency: 'NGN',
        description: 'Market run — Shoprite',
      },
    },
    {
      id: 'seed-act-00000007',
      actorId: USERS.derrick.id,
      poolId: POOLS.lunch.id,
      type: 'expense.created',
      createdAt: '2026-04-07',
      metadata: {
        expense_id: 'seed-exp-lnch-000001',
        amount: 15000,
        currency: 'NGN',
        description: 'Buka lunch — Monday',
      },
    },
    {
      id: 'seed-act-00000008',
      actorId: USERS.chidi.id,
      poolId: POOLS.lunch.id,
      type: 'expense.created',
      createdAt: '2026-04-14',
      metadata: {
        expense_id: 'seed-exp-lnch-000002',
        amount: 21000,
        currency: 'NGN',
        description: 'Mr. Biggs — team lunch',
      },
    },
    {
      id: 'seed-act-00000009',
      actorId: USERS.chidi.id,
      poolId: POOLS.lunch.id,
      type: 'settlement.submitted',
      createdAt: '2026-04-09',
      metadata: {
        settlement_id: 'seed-settle-0000003',
        amount: 5000,
        currency: 'NGN',
        to_user_id: USERS.derrick.id,
      },
    },
    {
      id: 'seed-act-00000010',
      actorId: USERS.derrick.id,
      poolId: POOLS.teamOutings.id,
      type: 'expense.created',
      createdAt: '2026-04-12',
      metadata: {
        expense_id: 'seed-exp-out-0000001',
        amount: 90000,
        currency: 'NGN',
        description: 'Escape room + dinner — team outing',
      },
    },
    {
      id: 'seed-act-00000011',
      actorId: USERS.tunde.id,
      poolId: POOLS.teamOutings.id,
      type: 'settlement.submitted',
      createdAt: '2026-04-20',
      metadata: {
        settlement_id: 'seed-settle-0000004',
        amount: 30000,
        currency: 'NGN',
        to_user_id: USERS.derrick.id,
      },
    },
    {
      id: 'seed-act-00000012',
      actorId: USERS.derrick.id,
      poolId: POOLS.teamOutings.id,
      type: 'settlement.disputed',
      createdAt: '2026-04-20',
      metadata: {
        settlement_id: 'seed-settle-0000004',
        reason: 'Amount does not match what was agreed',
      },
    },
    {
      id: 'seed-act-00000013',
      actorId: USERS.tunde.id,
      poolId: POOLS.groceries.id,
      type: 'expense.created',
      createdAt: '2026-04-15',
      metadata: {
        expense_id: 'seed-exp-groc-000002',
        amount: 18000,
        currency: 'NGN',
        description: 'Cooking gas refill',
      },
    },
    {
      id: 'seed-act-00000014',
      actorId: USERS.tunde.id,
      poolId: POOLS.lunch.id,
      type: 'expense.created',
      createdAt: '2026-04-21',
      metadata: {
        expense_id: 'seed-exp-lnch-000003',
        amount: 12000,
        currency: 'NGN',
        description: 'Shawarma run',
      },
    },
    {
      id: 'seed-act-00000015',
      actorId: USERS.chidi.id,
      poolId: POOLS.teamOutings.id,
      type: 'expense.created',
      createdAt: '2026-04-18',
      metadata: {
        expense_id: 'seed-exp-out-0000002',
        amount: 45000,
        currency: 'NGN',
        description: 'Go-karting — Friday fun',
      },
    },
    // Family activities
    {
      id: 'seed-act-00000016',
      actorId: USERS.derrick.id,
      poolId: POOLS.familyUpkeep.id,
      type: 'expense.created',
      createdAt: '2026-04-01',
      metadata: {
        expense_id: 'seed-exp-fam-up-00001',
        amount: 80000,
        currency: 'NGN',
        description: "Mum's monthly upkeep — April",
      },
    },
    {
      id: 'seed-act-00000017',
      actorId: USERS.ngozi.id,
      poolId: POOLS.familyUpkeep.id,
      type: 'settlement.submitted',
      createdAt: '2026-04-03',
      metadata: {
        settlement_id: 'seed-settle-0000006',
        amount: 20000,
        currency: 'NGN',
        to_user_id: USERS.derrick.id,
      },
    },
    {
      id: 'seed-act-00000018',
      actorId: USERS.derrick.id,
      poolId: POOLS.familyUpkeep.id,
      type: 'settlement.confirmed',
      createdAt: '2026-04-03',
      metadata: {
        settlement_id: 'seed-settle-0000006',
        amount: 20000,
        currency: 'NGN',
        from_user_id: USERS.ngozi.id,
      },
    },
    {
      id: 'seed-act-00000019',
      actorId: USERS.ngozi.id,
      poolId: POOLS.familyUpkeep.id,
      type: 'expense.created',
      createdAt: '2026-04-10',
      metadata: {
        expense_id: 'seed-exp-fam-up-00002',
        amount: 35000,
        currency: 'NGN',
        description: "Dad's medication — April",
      },
    },
    {
      id: 'seed-act-00000020',
      actorId: USERS.derrick.id,
      poolId: POOLS.familyEvents.id,
      type: 'expense.created',
      createdAt: '2026-04-05',
      metadata: {
        expense_id: 'seed-exp-fam-ev-00001',
        amount: 150000,
        currency: 'NGN',
        description: "Mum's 60th birthday — hall & catering deposit",
      },
    },
    {
      id: 'seed-act-00000021',
      actorId: USERS.ngozi.id,
      poolId: POOLS.familyEvents.id,
      type: 'settlement.submitted',
      createdAt: '2026-04-06',
      metadata: {
        settlement_id: 'seed-settle-0000007',
        amount: 37500,
        currency: 'NGN',
        to_user_id: USERS.derrick.id,
      },
    },
    {
      id: 'seed-act-00000022',
      actorId: USERS.amaka.id,
      poolId: POOLS.familyEvents.id,
      type: 'expense.created',
      createdAt: '2026-04-14',
      metadata: {
        expense_id: 'seed-exp-fam-ev-00002',
        amount: 45000,
        currency: 'NGN',
        description: 'Aso-ebi fabric — 3 pieces',
      },
    },
    {
      id: 'seed-act-00000023',
      actorId: USERS.emeka.id,
      poolId: POOLS.familyUpkeep.id,
      type: 'expense.created',
      createdAt: '2026-04-17',
      metadata: {
        expense_id: 'seed-exp-fam-up-00003',
        amount: 50000,
        currency: 'NGN',
        description: 'Generator fuel & repairs — compound',
      },
    },
    // Friends activities
    {
      id: 'seed-act-00000024',
      actorId: USERS.derrick.id,
      poolId: POOLS.friendsHangouts.id,
      type: 'expense.created',
      createdAt: '2026-04-06',
      metadata: {
        expense_id: 'seed-exp-frnd-hg-0001',
        amount: 60000,
        currency: 'NGN',
        description: 'Cubana nightout — bottles & entry',
      },
    },
    {
      id: 'seed-act-00000025',
      actorId: USERS.derrick.id,
      poolId: POOLS.friendsTrip.id,
      type: 'expense.created',
      createdAt: '2026-04-08',
      metadata: {
        expense_id: 'seed-exp-frnd-tr-0001',
        amount: 120000,
        currency: 'NGN',
        description: 'Airbnb — Ibadan 3 nights',
      },
    },
    {
      id: 'seed-act-00000026',
      actorId: USERS.tunde.id,
      poolId: POOLS.friendsTrip.id,
      type: 'settlement.submitted',
      createdAt: '2026-04-11',
      metadata: {
        settlement_id: 'seed-settle-0000009',
        amount: 30000,
        currency: 'NGN',
        to_user_id: USERS.derrick.id,
      },
    },
    {
      id: 'seed-act-00000027',
      actorId: USERS.tunde.id,
      poolId: POOLS.friendsHangouts.id,
      type: 'expense.created',
      createdAt: '2026-04-13',
      metadata: {
        expense_id: 'seed-exp-frnd-hg-0002',
        amount: 28000,
        currency: 'NGN',
        description: 'Cinema + popcorn — Imax Lagos',
      },
    },
    {
      id: 'seed-act-00000028',
      actorId: USERS.chidi.id,
      poolId: POOLS.friendsHangouts.id,
      type: 'expense.created',
      createdAt: '2026-04-20',
      metadata: {
        expense_id: 'seed-exp-frnd-hg-0003',
        amount: 20000,
        currency: 'NGN',
        description: 'Sunday jollof + drinks',
      },
    },
  ];

  for (const a of activities) {
    await db.execute(sql`
      INSERT INTO activities (id, actor_id, pool_id, type, metadata, created_at)
      VALUES (${a.id}, ${a.actorId}, ${a.poolId}, ${a.type}, ${JSON.stringify(a.metadata)}, ${new Date(a.createdAt)})
      ON CONFLICT (id) DO NOTHING
    `);
  }

  // ─── Notifications ─────────────────────────────────────────────────────────
  log('Inserting notifications...');
  const notifications = [
    // Derrick — needs to confirm Emeka's payment (Family Upkeep)
    {
      id: 'seed-notif-0000001',
      userId: USERS.derrick.id,
      type: 'settlement.submitted',
      title: 'Payment awaiting confirmation',
      body: "Emeka sent you ₦20,000 for Mum's upkeep. Tap to confirm or dispute.",
      isRead: false,
      createdAt: '2026-04-22',
      metadata: {
        action: 'confirm_settlement',
        settlement_id: 'seed-settle-0000008',
        pool_id: 'seed-pool-fam-upkeep-01',
        from_user: USERS.emeka.id,
        amount: '20000.00',
      },
    },
    // Derrick — needs to confirm Chidi's payment (Friends Hangouts)
    {
      id: 'seed-notif-0000002',
      userId: USERS.derrick.id,
      type: 'settlement.submitted',
      title: 'Payment awaiting confirmation',
      body: 'Chidi sent you ₦15,000 for Cubana. Tap to confirm or dispute.',
      isRead: false,
      createdAt: '2026-04-19',
      metadata: {
        action: 'confirm_settlement',
        settlement_id: 'seed-settle-0000010',
        pool_id: 'seed-pool-frnd-hang-001',
        from_user: USERS.chidi.id,
        amount: '15000.00',
      },
    },
    // Amaka — needs to confirm Tunde's payment (Monthly Bills)
    {
      id: 'seed-notif-0000003',
      userId: USERS.amaka.id,
      type: 'settlement.submitted',
      title: 'Payment awaiting confirmation',
      body: 'Tunde sent you ₦15,000 for NEPA April. Tap to confirm or dispute.',
      isRead: false,
      createdAt: '2026-04-22',
      metadata: {
        action: 'confirm_settlement',
        settlement_id: 'seed-settle-0000002',
        pool_id: 'seed-pool-monthly-00001',
        from_user: USERS.tunde.id,
        amount: '15000.00',
      },
    },
    // Tunde — needs to confirm Amaka's payment (Groceries)
    {
      id: 'seed-notif-0000004',
      userId: USERS.tunde.id,
      type: 'settlement.submitted',
      title: 'Payment awaiting confirmation',
      body: 'Amaka sent you ₦6,000 for gas refill share. Tap to confirm or dispute.',
      isRead: false,
      createdAt: '2026-04-21',
      metadata: {
        action: 'confirm_settlement',
        settlement_id: 'seed-settle-0000005',
        pool_id: 'seed-pool-grocery-00001',
        from_user: USERS.amaka.id,
        amount: '6000.00',
      },
    },
    // Tunde — his payment to Derrick was disputed (Team Outings)
    {
      id: 'seed-notif-0000005',
      userId: USERS.tunde.id,
      type: 'settlement.disputed',
      title: 'Your payment was disputed',
      body: 'Derrick disputed your ₦30,000 payment. Reason: Amount does not match what was agreed.',
      isRead: false,
      createdAt: '2026-04-20',
      metadata: {
        action: 'view_dispute',
        settlement_id: 'seed-settle-0000004',
        pool_id: 'seed-pool-outing-000001',
        reason: 'Amount does not match what was agreed',
      },
    },
    // Emeka — his payment to Derrick was disputed (Friends Hangouts)
    {
      id: 'seed-notif-0000006',
      userId: USERS.emeka.id,
      type: 'settlement.disputed',
      title: 'Your payment was disputed',
      body: 'Derrick disputed your ₦15,000 payment. Reason: Wrong amount sent.',
      isRead: false,
      createdAt: '2026-04-21',
      metadata: {
        action: 'view_dispute',
        settlement_id: 'seed-settle-0000011',
        pool_id: 'seed-pool-frnd-hang-001',
        reason: 'Wrong amount sent',
      },
    },
  ];

  for (const n of notifications) {
    await db.execute(sql`
      INSERT INTO notifications (id, user_id, type, title, body, metadata, is_read, created_at)
      VALUES (${n.id}, ${n.userId}, ${n.type}, ${n.title}, ${n.body}, ${JSON.stringify(n.metadata)}, ${n.isRead}, ${new Date(n.createdAt)})
      ON CONFLICT (id) DO NOTHING
    `);
  }

  log('✅ Seed complete!');
  log('');
  log('Login: Derrick → use your normal Google Sign-In (derrick.onyekachi@gmail.com)');
  log('');
  log('Seed session tokens for other users (Bearer token):');
  for (const u of seedOnlyUsers) {
    log(`  ${u.name.padEnd(20)} →  billbot_seed_${u.id}`);
  }

  await pool.end();
}

seed().catch((e) => {
  console.error('[seed] Failed:', e);
  process.exit(1);
});
