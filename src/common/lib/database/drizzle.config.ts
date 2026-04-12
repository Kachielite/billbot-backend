import type { Config } from 'drizzle-kit';
import { CONSTANTS } from '@/common/configuration/constants';

const config: Config = {
  schema: './src/modules/*/*.schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: CONSTANTS.DATABASE_URL,
  },
};

export default config;
