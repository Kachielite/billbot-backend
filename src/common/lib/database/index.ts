import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { injectable } from 'tsyringe';
import { CONSTANTS } from '@/common/configuration/constants';
import logger from '@/common/lib/logger';
import path from 'path';

@injectable()
class Database {
  private pool: Pool;
  public client: NodePgDatabase;

  constructor() {
    this.pool = new Pool({ connectionString: CONSTANTS.DATABASE_URL });
    this.client = drizzle(this.pool);
  }

  async migrate(): Promise<void> {
    try {
      await migrate(this.client, { migrationsFolder: path.join(process.cwd(), 'drizzle') });
      logger.info('Database migrations applied successfully.');
    } catch (error) {
      logger.error(`Database migration failed: ${error}`);
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export default Database;
