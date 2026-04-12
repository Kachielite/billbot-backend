import 'reflect-metadata';
import { configureContainer } from './init-dependencies';
import { container } from 'tsyringe';
import App from './app';
import { CONSTANTS, validateEnv } from '@/common/configuration/constants';
import logger from '@/common/lib/logger';

async function bootstrap() {
  try {
    validateEnv();
    await configureContainer();
    const app = container.resolve(App);
    app.start(CONSTANTS.PORT);
  } catch (error) {
    logger.error(`Failed to start BillBot: ${error}`);
    process.exit(1);
  }
}

bootstrap();
