import dotenv from 'dotenv';

dotenv.config();

export const CONSTANTS = {
  PORT: process.env.PORT || '3000',
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || '',
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  WEB_CLIENT_ID: process.env.WEB_CLIENT_ID || '',
  APPLE_BUNDLE_ID: process.env.APPLE_BUNDLE_ID || 'app.billbot',
  APP_BASE_URL: process.env.APP_BASE_URL || 'http://localhost:3000',
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN || 'http://localhost:3001',
  // Email (Google SMTP — requires a Gmail App Password)
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
};

/**
 * Validates that required environment variables are present.
 * In non-development environments, missing required vars are fatal.
 */
const REQUIRED_IN_PRODUCTION: Array<keyof typeof CONSTANTS> = [
  'DATABASE_URL',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'GOOGLE_CLIENT_ID',
];

export function validateEnv(): void {
  const isProduction = CONSTANTS.NODE_ENV !== 'development' && CONSTANTS.NODE_ENV !== 'test';
  const missing: string[] = [];

  for (const key of REQUIRED_IN_PRODUCTION) {
    if (!CONSTANTS[key]) {
      if (isProduction) {
        missing.push(key);
      } else {
        // eslint-disable-next-line no-console
        console.warn(`[BillBot] Missing env var: ${key} (non-fatal in development)`);
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. Refusing to start.`,
    );
  }
}
