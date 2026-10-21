import { Router } from 'express';
import { UserRole } from '../../generated/prisma/enums';
import { prisma } from '../../lib/prisma';
import { authenticate, requireUserRole } from '../auth/auth.middleware';
import { createPrismaProjectRepository } from './project.repository';
import { createProjectSchema, listProjectsQuerySchema } from './project.schema';
import { createProjectService, type ProjectService } from './project.service';

const defaultProjectService = createProjectService(
  createPrismaProjectRepository(prisma),
);

export function createProjectRouter(
  projectService: ProjectService = defaultProjectService,
) {
  const router = Router();
  router.use(authenticate);
  router.use((_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });

  router.get('/', async (request, response) => {
    const query = listProjectsQuerySchema.parse(request.query);
    const result = await projectService.list(request.auth!.userId, query);
    response.json(result);
  });

  router.post(
    '/',
    requireUserRole(UserRole.FREELANCER),
    async (request, response) => {
      const input = createProjectSchema.parse(request.body);
      const project = await projectService.create(request.auth!.userId, input);
      response.status(201).json({ data: project });
    },
  );

  return router;
}
