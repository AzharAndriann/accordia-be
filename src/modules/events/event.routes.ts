import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { authenticate } from '../auth/auth.middleware';
import { createPrismaEventRepository } from './event.repository';
import { eventProjectParamsSchema, listEventsQuerySchema } from './event.schema';
import { createEventService, type EventService } from './event.service';

const defaultService = createEventService(createPrismaEventRepository(prisma));
export function createEventRouter(service: EventService = defaultService) {
  const router = Router();
  router.use(authenticate);
  router.use((_request, response, next) => { response.setHeader('Cache-Control', 'no-store'); next(); });
  router.get('/projects/:projectId/events', async (request, response) => {
    const { projectId } = eventProjectParamsSchema.parse(request.params);
    const query = listEventsQuerySchema.parse(request.query);
    response.json(await service.list(request.auth!.userId, projectId, query));
  });
  return router;
}
