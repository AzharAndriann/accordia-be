import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { prisma } from '../../lib/prisma';
import { authenticate } from '../auth/auth.middleware';
import { createPrismaPaymentRepository } from './payment.repository';
import { createPaymentSchema, listPaymentsQuerySchema, paymentParamsSchema, paymentProjectParamsSchema, rejectPaymentSchema } from './payment.schema';
import { createPaymentService, type PaymentService } from './payment.service';

const mutationLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Terlalu banyak percobaan, silakan coba lagi nanti' } } });
const defaultService = createPaymentService(createPrismaPaymentRepository(prisma));

export function createPaymentRouter(service: PaymentService = defaultService) {
  const router = Router();
  router.use(authenticate);
  router.use((_request, response, next) => { response.setHeader('Cache-Control', 'no-store'); next(); });
  router.get('/projects/:projectId/payments', async (request, response) => {
    const { projectId } = paymentProjectParamsSchema.parse(request.params);
    const query = listPaymentsQuerySchema.parse(request.query);
    response.json(await service.list(request.auth!.userId, projectId, query));
  });
  router.post('/projects/:projectId/payments', mutationLimiter, async (request, response) => {
    const { projectId } = paymentProjectParamsSchema.parse(request.params);
    const input = createPaymentSchema.parse(request.body);
    const result = await service.create(request.auth!.userId, projectId, input);
    response.status(201).json({ data: result.payment, paymentSummary: result.paymentSummary });
  });
  router.post('/payments/:paymentId/confirm', mutationLimiter, async (request, response) => {
    const { paymentId } = paymentParamsSchema.parse(request.params);
    const result = await service.confirm(request.auth!.userId, paymentId);
    response.json({ data: result.payment, paymentSummary: result.paymentSummary });
  });
  router.post('/payments/:paymentId/reject', mutationLimiter, async (request, response) => {
    const { paymentId } = paymentParamsSchema.parse(request.params);
    const { reason } = rejectPaymentSchema.parse(request.body);
    const result = await service.reject(request.auth!.userId, paymentId, reason);
    response.json({ data: result.payment, paymentSummary: result.paymentSummary });
  });
  return router;
}
