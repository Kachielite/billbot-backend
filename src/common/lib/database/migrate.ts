import 'reflect-metadata';
import '@/common/configuration/constants';
import Database from './index';

async function runMigrations() {
  const db = new Database();
  await db.migrate();
  await db.close();
  process.exit(0);
}

runMigrations().catch((err) => {
  process.stderr.write(`Migration error: ${err}\n`);
  process.exit(1);
});
