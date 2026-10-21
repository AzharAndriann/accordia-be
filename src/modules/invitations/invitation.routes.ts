import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { UserRole } from '../../generated/prisma/enums';
import { prisma } from '../../lib/prisma';
import { authenticate, requireUserRole } from '../auth/auth.middleware';
import { createPrismaInvitationRepository } from './invitation.repository';
import {
  acceptInvitationSchema,
  createInvitationSchema,
  invitationProjectParamsSchema,
} from './invitation.schema';
import {
  createInvitationService,
  type InvitationService,
} from './invitation.service';

const rateLimitResponse = {
  error: {
    code: 'RATE_LIMITED',
    message: 'Terlalu banyak percobaan, silakan coba lagi nanti',
  },
};

const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1_000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: rateLimitResponse,
});

const acceptLimiter = rateLimit({
  windowMs: 15 * 60 * 1_000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: rateLimitResponse,
});

const defaultInvitationService = createInvitationService(
  createPrismaInvitationRepository(prisma),
);

export function createInvitationRouter(
  invitationService: InvitationService = defaultInvitationService,
) {
  const router = Router();
  router.use(authenticate);
  router.use((_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });

  router.post(
    '/projects/:projectId/invitations',
    createLimiter,
    requireUserRole(UserRole.FREELANCER),
    async (request, response) => {
      const { projectId } = invitationProjectParamsSchema.parse(request.params);
      const input = createInvitationSchema.parse(request.body);
      const invitation = await invitationService.create(
        request.auth!.userId,
        projectId,
        input,
      );
      response.status(201).json({ data: invitation });
    },
  );

  router.post(
    '/invitations/accept',
    acceptLimiter,
    requireUserRole(UserRole.CLIENT),
    async (request, response) => {
      const input = acceptInvitationSchema.parse(request.body);
      const membership = await invitationService.accept(
        request.auth!.userId,
        input,
      );
      response.json({ data: membership });
    },
  );

  return router;
}
