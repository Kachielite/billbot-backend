import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';
import path from 'path';
import { CONSTANTS } from '@/common/configuration/constants';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'BillBot API',
      version: '1.0.0',
      description:
        'BillBot — shared expense splitting and settlement platform for African communal financial obligations.',
    },
    servers: [
      {
        url: `${CONSTANTS.APP_BASE_URL}/v1`,
        description: 'API Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'Token',
          description: 'Session token returned from /auth/google or /auth/apple',
        },
      },
      schemas: {
        GeneralResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object', nullable: true },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            statusCode: { type: 'integer' },
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            page: { type: 'integer' },
            limit: { type: 'integer' },
            total_items: { type: 'integer' },
            pages: { type: 'integer' },
            items: { type: 'array', items: {} },
          },
        },
      },
      responses: {
        Unauthorized: {
          description: 'Unauthorized — missing or invalid Bearer token',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: { statusCode: 401, error: 'Unauthorized', message: 'Invalid session token' },
            },
          },
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                statusCode: 404,
                error: 'Resource Not Found',
                message: 'Resource not found.',
              },
            },
          },
        },
        BadRequest: {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: { statusCode: 400, error: 'Bad Request', message: 'Validation failed.' },
            },
          },
        },
        Forbidden: {
          description: 'Forbidden — insufficient permissions',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: { statusCode: 403, error: 'Forbidden', message: 'Admin access required.' },
            },
          },
        },
        InternalServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                statusCode: 500,
                error: 'Internal Server Error',
                message: 'An unexpected error occurred.',
              },
            },
          },
        },
      },
    },
  },
  apis: [path.join(process.cwd(), 'src/modules/**/*controller.ts')],
};

export function setupSwagger(app: Express): void {
  // Do not expose API docs in production — route exploration is a privilege, not a default.
  if (CONSTANTS.NODE_ENV === 'production') {
    return;
  }

  const spec = swaggerJsdoc(options);

  app.get('/api-docs.init.js', (_req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.send(`
      window.addEventListener('load', function () {
        var link = document.createElement('a');
        link.href = '/api-docs.json';
        link.download = 'billbot-api.json';
        link.textContent = 'Download OpenAPI JSON';
        link.style.cssText = 'position:fixed;top:12px;right:16px;z-index:9999;background:#49cc90;color:#fff;padding:6px 14px;border-radius:4px;font-size:13px;font-weight:bold;text-decoration:none;font-family:sans-serif;';
        document.body.appendChild(link);
      });
    `);
  });

  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(spec, { explorer: true, customJs: '/api-docs.init.js' }),
  );
  app.get('/api-docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(spec);
  });
}
