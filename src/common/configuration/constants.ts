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
  JWT_SECRET: process.env.JWT_SECRET || 'changeme-secret',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  APPLE_BUNDLE_ID: process.env.APPLE_BUNDLE_ID || 'app.billbot',
  APP_BASE_URL: process.env.APP_BASE_URL || 'http://localhost:3000',
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN || 'http://localhost:3001',
};
