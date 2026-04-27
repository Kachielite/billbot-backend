import { inject, injectable } from 'tsyringe';
import { eq, desc } from 'drizzle-orm';
import Database from '@/common/lib/database';
import { SettlementSchema } from './settlements.schema';
import { ISettlement } from './settlements.interface';

export interface ISettlementRepository {
  create(data: {
    id: string;
    poolId: string;
    fromUser: string;
    toUser: string;
    amount: string;
    currency: string;
    proofUrl?: string | null;
    note?: string | null;
  }): Promise<ISettlement>;
  findById(id: string): Promise<ISettlement | null>;
  findByPool(poolId: string): Promise<ISettlement[]>;
  update(
    id: string,
    data: Partial<{
      status: string;
      disputedReason: string | null;
      confirmedAt: Date | null;
    }>,
  ): Promise<ISettlement>;
}

@injectable()
class SettlementRepositoryImpl implements ISettlementRepository {
  constructor(@inject(Database) private db: Database) {}

  async create(data: {
    id: string;
    poolId: string;
    fromUser: string;
    toUser: string;
    amount: string;
    currency: string;
    proofUrl?: string | null;
    note?: string | null;
  }): Promise<ISettlement> {
    const [row] = await this.db.client.insert(SettlementSchema).values(data).returning();
    return row as unknown as ISettlement;
  }

  async findById(id: string): Promise<ISettlement | null> {
    const rows = await this.db.client
      .select()
      .from(SettlementSchema)
      .where(eq(SettlementSchema.id, id))
      .limit(1);
    return (rows[0] as unknown as ISettlement) ?? null;
  }

  async findByPool(poolId: string): Promise<ISettlement[]> {
    const rows = await this.db.client
      .select()
      .from(SettlementSchema)
      .where(eq(SettlementSchema.poolId, poolId))
      .orderBy(desc(SettlementSchema.createdAt));
    return rows as unknown as ISettlement[];
  }

  async update(
    id: string,
    data: Partial<{
      status: string;
      disputedReason: string | null;
      confirmedAt: Date | null;
    }>,
  ): Promise<ISettlement> {
    const updateData: Partial<typeof SettlementSchema.$inferInsert> = {};
    if (data.status !== undefined) updateData.status = data.status;
    if (data.disputedReason !== undefined) updateData.disputedReason = data.disputedReason;
    if (data.confirmedAt !== undefined) updateData.confirmedAt = data.confirmedAt;

    const [row] = await this.db.client
      .update(SettlementSchema)
      .set(updateData)
      .where(eq(SettlementSchema.id, id))
      .returning();
    return row as unknown as ISettlement;
  }
}

export default SettlementRepositoryImpl;
