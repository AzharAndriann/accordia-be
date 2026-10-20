import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { prisma } from '../../lib/prisma';
import { authenticate } from '../auth/auth.middleware';
import { createPrismaChangeRepository } from './change.repository';
import { changeProjectParamsSchema, createChangeRequestSchema, listChangeRequestsQuerySchema } from './change.schema';
import { createChangeService, type ChangeService } from './change.service';

const mutationLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Terlalu banyak percobaan, silakan coba lagi nanti' } },
});

const defaultService = createChangeService(createPrismaChangeRepository(prisma));

export function createChangeRouter(service: ChangeService = defaultService) {
  const router = Router();
  router.use(authenticate);
  router.use((_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });

  router.get('/projects/:projectId/change-requests', async (request, response) => {
    const { projectId } = changeProjectParamsSchema.parse(request.params);
    const query = listChangeRequestsQuerySchema.parse(request.query);
    response.json(await service.list(request.auth!.userId, projectId, query));
  });

  router.post('/projects/:projectId/change-requests', mutationLimiter, async (request, response) => {
    const { projectId } = changeProjectParamsSchema.parse(request.params);
    const input = createChangeRequestSchema.parse(request.body);
    response.status(201).json({ data: await service.create(request.auth!.userId, projectId, input) });
  });

  return router;
}
