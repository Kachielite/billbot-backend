/**
 * One-time retroactive cascade script.
 *
 * The old settlement confirmation code only settled the payer's splits on the
 * direct recipient's expenses. The new cascade algorithm settles ALL of the
 * payer's splits across all creditors and propagates credits through the pool.
 *
 * This script re-runs the cascade for every confirmed settlement, which is safe
 * because getUnsettledObligationSplits only returns splits that are still
 * unsettled — already-settled splits are never touched twice.
 *
 * Run: npx ts-node -r tsconfig-paths/register scripts/retroactive-cascade.ts
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, ne } from 'drizzle-orm';
import { CONSTANTS } from '../src/common/configuration/constants';
import { SettlementSchema } from '../src/modules/settlements/settlements.schema';
import { ExpenseSchema, ExpenseSplitSchema } from '../src/modules/expenses/expenses.schema';

const pool = new Pool({ connectionString: CONSTANTS.DATABASE_URL });
const db: NodePgDatabase = drizzle(pool);

// ── helpers ──────────────────────────────────────────────────────────────────

async function getUnsettledObligationSplits(poolId: string, owedBy: string) {
  const rows = await db
    .select({ split: ExpenseSplitSchema, paidBy: ExpenseSchema.paidBy })
    .from(ExpenseSplitSchema)
    .innerJoin(ExpenseSchema, eq(ExpenseSplitSchema.expenseId, ExpenseSchema.id))
    .where(
      and(
        eq(ExpenseSchema.poolId, poolId),
        eq(ExpenseSplitSchema.owedBy, owedBy),
        eq(ExpenseSplitSchema.settled, false),
        ne(ExpenseSchema.paidBy, owedBy),
      ),
    )
    .orderBy(ExpenseSchema.createdAt);

  return rows.map((r) => ({
    ...r.split,
    paidBy: r.paidBy,
  }));
}

async function markSplitSettled(splitId: string) {
  const now = new Date();
  const [split] = await db
    .select({ amount: ExpenseSplitSchema.amount })
    .from(ExpenseSplitSchema)
    .where(eq(ExpenseSplitSchema.id, splitId))
    .limit(1);
  if (!split) return;
  await db
    .update(ExpenseSplitSchema)
    .set({ settled: true, settledAt: now, amountSettled: split.amount, amountRemaining: '0' })
    .where(eq(ExpenseSplitSchema.id, splitId));
}

async function partiallySettleSplit(splitId: string, amount: number) {
  const now = new Date();
  const [split] = await db
    .select({ amount: ExpenseSplitSchema.amount, amountSettled: ExpenseSplitSchema.amountSettled })
    .from(ExpenseSplitSchema)
    .where(eq(ExpenseSplitSchema.id, splitId))
    .limit(1);
  if (!split) return;
  const newSettled = parseFloat(split.amountSettled) + amount;
  const newRemaining = parseFloat(split.amount) - newSettled;
  const fullySettled = newRemaining <= 0.01;
  await db
    .update(ExpenseSplitSchema)
    .set({
      amountSettled: newSettled.toFixed(2),
      amountRemaining: fullySettled ? '0' : newRemaining.toFixed(2),
      settled: fullySettled,
      settledAt: fullySettled ? now : null,
    })
    .where(eq(ExpenseSplitSchema.id, splitId));
}

async function cascadeCredit(poolId: string, userId: string, amount: number): Promise<void> {
  if (amount < 0.01) return;

  const splits = await getUnsettledObligationSplits(poolId, userId);
  if (splits.length === 0) return;

  let remaining = amount;
  const newCredits = new Map<string, number>();

  for (const split of splits) {
    if (remaining < 0.01) break;
    const splitRemaining = parseFloat(split.amountRemaining);
    const toSettle = Math.min(splitRemaining, remaining);
    if (splitRemaining - toSettle < 0.01) {
      await markSplitSettled(split.id);
    } else {
      await partiallySettleSplit(split.id, toSettle);
    }
    if (split.paidBy) {
      newCredits.set(split.paidBy, (newCredits.get(split.paidBy) ?? 0) + toSettle);
    }
    remaining -= toSettle;
  }

  for (const [creditor, creditAmount] of newCredits) {
    await cascadeCredit(poolId, creditor, creditAmount);
  }
}

async function runCascadeForSettlement(
  poolId: string,
  fromUser: string,
  toUser: string,
  amount: number,
): Promise<void> {
  console.log(`  cascade: fromUser=${fromUser} toUser=${toUser} amount=${amount}`);

  const splits = await getUnsettledObligationSplits(poolId, fromUser);
  let remaining = amount;
  const creditorCredits = new Map<string, number>();

  for (const split of splits) {
    if (remaining < 0.01) break;
    const splitRemaining = parseFloat(split.amountRemaining);
    const toSettle = Math.min(splitRemaining, remaining);
    if (splitRemaining - toSettle < 0.01) {
      await markSplitSettled(split.id);
    } else {
      await partiallySettleSplit(split.id, toSettle);
    }
    if (split.paidBy) {
      creditorCredits.set(split.paidBy, (creditorCredits.get(split.paidBy) ?? 0) + toSettle);
    }
    remaining -= toSettle;
  }

  for (const [creditor, creditAmount] of creditorCredits) {
    if (creditor !== toUser) {
      console.log(`    cascade credit to non-toUser creditor ${creditor}: ${creditAmount}`);
      await cascadeCredit(poolId, creditor, creditAmount);
    }
  }

  const toUserDirect = creditorCredits.get(toUser) ?? 0;
  const excess = amount - toUserDirect;
  if (excess > 0.01) {
    console.log(`    cascade excess to toUser ${toUser}: ${excess}`);
    await cascadeCredit(poolId, toUser, excess);
  }
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Fetching all confirmed settlements...');

  const settlements = await db
    .select()
    .from(SettlementSchema)
    .where(eq(SettlementSchema.status, 'settled'));

  console.log(`Found ${settlements.length} confirmed settlement(s).`);

  for (const s of settlements) {
    if (!s.poolId || !s.fromUser || !s.toUser) {
      console.log(`Skipping settlement ${s.id} — missing pool/user data`);
      continue;
    }
    console.log(`\nProcessing settlement ${s.id}: ${s.fromUser} → ${s.toUser}, amount=${s.amount}`);
    await runCascadeForSettlement(s.poolId, s.fromUser, s.toUser, parseFloat(s.amount));
  }

  console.log('\nRetroactive cascade complete.');
  await pool.end();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
