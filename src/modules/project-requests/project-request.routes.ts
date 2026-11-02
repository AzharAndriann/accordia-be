import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { authenticate } from '../auth/auth.middleware';
import { createProjectRequestService, createRequestSchema, respondRequestSchema } from './project-request.service';

export function createProjectRequestRouter(service = createProjectRequestService(prisma)) {
  const router = Router();
  router.use(authenticate);
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  const limiter = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false });
  router.get('/projects/:projectId/requests', async (req, res) => {
    const projectId = z.string().uuid().parse(req.params.projectId);
    const query = z.object({ cursor: z.string().uuid().optional(), limit: z.coerce.number().int().min(1).max(100).default(20) }).strict().parse(req.query);
    res.json(await service.list(req.auth!.userId, projectId, query.limit, query.cursor));
  });
  router.post('/projects/:projectId/requests', limiter, async (req, res) => {
    const projectId = z.string().uuid().parse(req.params.projectId);
    res.status(201).json({ data: await service.create(req.auth!.userId, projectId, createRequestSchema.parse(req.body)) });
  });
  router.post('/project-requests/:requestId/respond', limiter, async (req, res) => {
    res.json({ data: await service.respond(req.auth!.userId, z.string().uuid().parse(req.params.requestId), respondRequestSchema.parse(req.body)) });
  });
  return router;
}
