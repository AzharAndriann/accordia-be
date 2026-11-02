import { AppError } from '../../shared/errors';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { UserRole } from '../../generated/prisma/enums';
import { prisma } from '../../lib/prisma';
import { authenticate, requireUserRole } from '../auth/auth.middleware';
import { createPrismaInvitationRepository } from './invitation.repository';
import {
  acceptInvitationSchema,
  projectInvitationParamsSchema,
  createInvitationSchema,
  invitationParamsSchema,
  invitationProjectParamsSchema,
  listInvitationsQuerySchema,
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

  router.get(
    '/projects/:projectId/invitations',
    requireUserRole(UserRole.FREELANCER),
    async (request, response) => {
      const { projectId } = invitationProjectParamsSchema.parse(request.params);
      const query = listInvitationsQuerySchema.parse(request.query);
      response.json(
        await invitationService.listByProject(request.auth!.userId, projectId, query),
      );
    },
  );

  router.delete(
    '/projects/:projectId/invitations/:invitationId',
    requireUserRole(UserRole.FREELANCER),
    async (request, response) => {
      const { projectId, invitationId } = projectInvitationParamsSchema.parse(request.params);
      const invitation = await invitationService.cancel(
        request.auth!.userId,
        projectId,
        invitationId,
      );
      response.json({ data: invitation });
    },
  );

  router.post(
    '/projects/:projectId/invitations/:invitationId/removal-request',
    requireUserRole(UserRole.FREELANCER),
    async (request, response) => {
      const { projectId, invitationId } = projectInvitationParamsSchema.parse(request.params);
      const removal = await invitationService.requestRemoval(
        request.auth!.userId,
        projectId,
        invitationId,
      );
      response.status(201).json({ data: removal });
    },
  );

  router.get(
    '/membership-removal-requests',
    requireUserRole(UserRole.CLIENT),
    async (request, response) => {
      const query = listInvitationsQuerySchema.parse(request.query);
      response.json(await invitationService.listRemovalRequests(request.auth!.userId, query));
    },
  );

  router.post(
    '/membership-removal-requests/:invitationId/approve',
    requireUserRole(UserRole.CLIENT),
    async (request, response) => {
      const { invitationId } = invitationParamsSchema.parse(request.params);
      const result = await invitationService.respondRemoval(
        request.auth!.userId,
        invitationId,
        'APPROVED',
      );
      response.json({ data: result });
    },
  );

  router.post(
    '/membership-removal-requests/:invitationId/reject',
    requireUserRole(UserRole.CLIENT),
    async (request, response) => {
      const { invitationId } = invitationParamsSchema.parse(request.params);
      const result = await invitationService.respondRemoval(
        request.auth!.userId,
        invitationId,
        'REJECTED',
      );
      response.json({ data: result });
    },
  );

  router.get('/invitations/:invitationId', requireUserRole(UserRole.CLIENT), async (request, response) => {
    const { invitationId } = invitationParamsSchema.parse(request.params);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: request.auth!.userId }, select: { email: true } });
    const invitation = await prisma.invitation.findFirst({ where: { id: invitationId, targetEmail: user.email }, select: { id: true, projectId: true, expiresAt: true, acceptedAt: true, cancelledAt: true, project: { select: { title: true } }, inviter: { select: { name: true } } } });
    if (!invitation) throw new AppError(404, 'INVITATION_NOT_FOUND', 'Undangan tidak ditemukan atau bukan untuk email akun ini');
    response.json({ data: { ...invitation, expired: invitation.expiresAt <= new Date() } });
  });

  router.get(
    '/invitations',
    requireUserRole(UserRole.CLIENT),
    async (request, response) => {
      const query = listInvitationsQuerySchema.parse(request.query);
      response.json(await invitationService.list(request.auth!.userId, query));
    },
  );

  router.post(
    '/invitations/:invitationId/accept',
    acceptLimiter,
    requireUserRole(UserRole.CLIENT),
    async (request, response) => {
      const { invitationId } = invitationParamsSchema.parse(request.params);
      const membership = await invitationService.acceptById(
        request.auth!.userId,
        invitationId,
      );
      response.json({ data: membership });
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
