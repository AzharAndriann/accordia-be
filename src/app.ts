import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { ZodError } from 'zod';
import { env } from './config/env';
import { openApiDocument } from './docs/openapi';
import { prisma } from './lib/prisma';
import { createAuthRouter } from './modules/auth/auth.routes';
import { createProjectRouter } from './modules/projects/project.routes';
import { createInvitationRouter } from './modules/invitations/invitation.routes';
import { createAgreementRouter } from './modules/agreements/agreement.routes';
import { createChangeRouter } from './modules/changes/change.routes';
import { createFileRouter } from './modules/files/file.routes';
import { createDeliveryRouter } from './modules/deliveries/delivery.routes';
import { AppError } from './shared/errors';

type ReadinessDatabase = {
  $queryRaw(query: TemplateStringsArray): Promise<unknown>;
};

export function createApp(database: ReadinessDatabase = prisma) {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);
  app.use(helmet());
  app.use(express.json({ limit: '1mb' }));
  app.use(cors({ origin: env.CORS_ORIGINS }));

  app.get('/api/v1/health', (_req, res) => {
    res.json({ data: { status: 'ok' } });
  });

  app.get('/api/v1/ready', async (_req, res) => {
    try {
      await database.$queryRaw`SELECT 1`;
      res.json({ data: { status: 'ready' } });
    } catch {
      res.status(503).json({
        error: { code: 'NOT_READY', message: 'Database belum siap' },
      });
    }
  });

  app.use('/api/v1/auth', createAuthRouter());
  app.use('/api/v1/projects', createProjectRouter());
  app.use('/api/v1', createInvitationRouter());
  app.use('/api/v1', createAgreementRouter());
  app.use('/api/v1', createChangeRouter());
  app.use('/api/v1', createFileRouter());
  app.use('/api/v1', createDeliveryRouter());

  if (env.API_DOCS_ENABLED) {
    app.get('/openapi.json', (_req, res) => res.json(openApiDocument));
    app.use(
      '/api-docs',
      swaggerUi.serve,
      swaggerUi.setup(openApiDocument, {
        swaggerOptions: { persistAuthorization: false },
      }),
    );
  }

  app.use((_req, res) => {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Endpoint tidak ditemukan' },
    });
  });

  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof AppError) {
      res.status(error.status).json({
        error: { code: error.code, message: error.message },
      });
      return;
    }

    if (error instanceof ZodError) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.issues[0]?.message ?? 'Input tidak valid',
        },
      });
      return;
    }

    const status =
      error?.type === 'entity.too.large'
        ? 413
        : error?.type === 'entity.parse.failed'
          ? 400
          : 500;

    res.status(status).json({
      error: {
        code:
          status === 413
            ? 'PAYLOAD_TOO_LARGE'
            : status === 400
              ? 'INVALID_JSON'
              : 'INTERNAL_ERROR',
        message: status === 500 ? 'Terjadi kesalahan server' : 'Request tidak valid',
      },
    });
  };

  app.use(errorHandler);

  return app;
}
