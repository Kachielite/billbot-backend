import { Router, Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { BadRequestException } from '@/common/exception';
import logger from '@/common/lib/logger';

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

interface RouteOptions {
  validate?: ZodSchema | { body?: ZodSchema; params?: ZodSchema; query?: ZodSchema };
  statusCode?: number;
}

export function Controller(prefix: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function (target: new (...args: any[]) => BaseController) {
    Reflect.defineMetadata('prefix', prefix, target);
  };
}

function createMethodDecorator(method: HttpMethod) {
  return function (path: string, options: RouteOptions = {}) {
    return function (target: object, propertyKey: string, descriptor: PropertyDescriptor) {
      const routes: Array<{
        method: HttpMethod;
        path: string;
        handler: string;
        options: RouteOptions;
      }> = Reflect.getMetadata('routes', target.constructor) || [];
      routes.push({ method, path, handler: propertyKey, options });
      Reflect.defineMetadata('routes', routes, target.constructor);
      return descriptor;
    };
  };
}

export const Get = createMethodDecorator('get');
export const Post = createMethodDecorator('post');
export const Put = createMethodDecorator('put');
export const Patch = createMethodDecorator('patch');
export const Delete = createMethodDecorator('delete');

export class BaseController {
  protected router: Router;

  constructor(router: Router) {
    this.router = router;
    this.registerRoutes();
  }

  private registerRoutes() {
    const prefix: string = Reflect.getMetadata('prefix', this.constructor) || '';
    const routes: Array<{
      method: HttpMethod;
      path: string;
      handler: string;
      options: RouteOptions;
    }> = Reflect.getMetadata('routes', this.constructor) || [];

    routes.forEach(({ method, path, handler, options }) => {
      const fullPath = path;
      const handlerFn = (this as unknown as Record<string, Function>)[handler].bind(this);

      this.router[method](fullPath, async (req: Request, res: Response, next: NextFunction) => {
        // Validation middleware inline
        if (options.validate) {
          try {
            if ('parse' in (options.validate as ZodSchema)) {
              const schema = options.validate as ZodSchema;
              req.body = schema.parse(req.body);
            } else {
              const schemas = options.validate as {
                body?: ZodSchema;
                params?: ZodSchema;
                query?: ZodSchema;
              };
              if (schemas.body) req.body = schemas.body.parse(req.body);
              if (schemas.params) req.params = schemas.params.parse(req.params);
              if (schemas.query) req.query = schemas.query.parse(req.query);
            }
          } catch (err: unknown) {
            const zodError = err as { errors?: Array<{ message: string }> };
            const message = zodError.errors?.[0]?.message || 'Validation failed';
            return next(new BadRequestException(message));
          }
        }

        try {
          const result = await handlerFn(req, res, next);
          if (result !== undefined && !res.headersSent) {
            res.status(options.statusCode || 200).json(result);
          }
        } catch (error) {
          next(error);
        }
      });
    });

    // One summary line per controller instead of a line per route
    const moduleName = this.constructor.name.replace(/Controller$/, '');
    const count = routes.length;
    logger.info(
      `${moduleName} service started with ${count} endpoint${count !== 1 ? 's' : ''} → /v1${prefix}`,
    );
  }

  getRouter(): Router {
    return this.router;
  }

  getPrefix(): string {
    return Reflect.getMetadata('prefix', this.constructor) || '';
  }
}
