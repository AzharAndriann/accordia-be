import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { prisma } from '../../lib/prisma';
import { authenticate } from '../auth/auth.middleware';
import { createPrismaDeliveryRepository } from './delivery.repository';
import { createDeliverySchema, deliveryParamsSchema, deliveryProjectParamsSchema, listDeliveriesQuerySchema, requestRevisionSchema } from './delivery.schema';
import { createDeliveryService, type DeliveryService } from './delivery.service';

const mutationLimiter = rateLimit({
  windowMs: 15 * 60_000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Terlalu banyak percobaan, silakan coba lagi nanti' } },
});
const defaultService = createDeliveryService(createPrismaDeliveryRepository(prisma));

export function createDeliveryRouter(service: DeliveryService = defaultService) {
  const router = Router();
  router.use(authenticate);
  router.use((_request, response, next) => { response.setHeader('Cache-Control', 'no-store'); next(); });

  router.get('/projects/:projectId/deliveries', async (request, response) => {
    const { projectId } = deliveryProjectParamsSchema.parse(request.params);
    const query = listDeliveriesQuerySchema.parse(request.query);
    response.json(await service.list(request.auth!.userId, projectId, query));
  });
  router.post('/projects/:projectId/deliveries', mutationLimiter, async (request, response) => {
    const { projectId } = deliveryProjectParamsSchema.parse(request.params);
    const input = createDeliverySchema.parse(request.body);
    response.status(201).json({ data: await service.create(request.auth!.userId, projectId, input) });
  });
  router.post('/deliveries/:deliveryId/accept', mutationLimiter, async (request, response) => {
    const { deliveryId } = deliveryParamsSchema.parse(request.params);
    response.json({ data: await service.accept(request.auth!.userId, deliveryId) });
  });
  router.post('/deliveries/:deliveryId/request-revision', mutationLimiter, async (request, response) => {
    const { deliveryId } = deliveryParamsSchema.parse(request.params);
    const { reason } = requestRevisionSchema.parse(request.body);
    response.json({ data: await service.requestRevision(request.auth!.userId, deliveryId, reason) });
  });
  return router;
}
