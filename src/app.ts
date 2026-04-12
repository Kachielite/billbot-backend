import 'reflect-metadata';
import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { inject, injectable } from 'tsyringe';
import { APP_TOKENS } from '@/common/constants/app.tokens';
import { CONSTANTS } from '@/common/configuration/constants';
import { setupSwagger } from '@/common/lib/swagger';
import { trafficFilter } from '@/middleware/traffic-filter.middleware';
import AuthenticationMiddleware from '@/middleware/authentication.middleware';
import {
  resourceNotFoundHandler,
  allExceptionHandler,
} from '@/middleware/global-exception.middleware';
import { applyMounts } from '@/common/utils/route-registry';
import logger from '@/common/lib/logger';

@injectable()
class App {
  private app: Express;

  constructor(
    @inject(APP_TOKENS.EXPRESS_APP) app: Express,
    @inject(AuthenticationMiddleware) private authMiddleware: AuthenticationMiddleware,
  ) {
    this.app = app;
    this.initiateMiddleware();
    this.initiateRoutes();
    this.initiateErrorHandler();
  }

  private initiateMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(helmet());
    this.app.use(
      cors({
        origin: CONSTANTS.FRONTEND_ORIGIN,
        credentials: true,
      }),
    );
    this.app.use(trafficFilter);
    this.app.use(this.authMiddleware.authenticate);

    // Health check
    this.app.get('/health', (_req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Swagger docs
    setupSwagger(this.app);
  }

  private initiateRoutes(): void {
    applyMounts(this.app);
  }

  private initiateErrorHandler(): void {
    this.app.use(resourceNotFoundHandler);
    this.app.use(allExceptionHandler);
  }

  start(port: string | number): void {
    this.app.listen(port, () => {
      logger.info(`BillBot API running on port ${port}`);
      logger.info(`Swagger docs: http://localhost:${port}/api-docs`);
    });
  }
}

export default App;
