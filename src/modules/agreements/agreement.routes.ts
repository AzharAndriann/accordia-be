import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { prisma } from '../../lib/prisma';
import { authenticate } from '../auth/auth.middleware';
import { createPrismaAgreementRepository } from './agreement.repository';
import {
  agreementProjectParamsSchema,
  createAgreementSchema,
  agreementVersionParamsSchema,
  approveAgreementSchema,
  listAgreementVersionsQuerySchema,
  rejectAgreementSchema,
  submitAgreementSchema,
  updateAgreementSchema,
} from './agreement.schema';
import {
  createAgreementService,
  type AgreementService,
} from './agreement.service';

const mutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1_000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Terlalu banyak percobaan, silakan coba lagi nanti',
    },
  },
});

const defaultAgreementService = createAgreementService(
  createPrismaAgreementRepository(prisma),
);

export function createAgreementRouter(
  agreementService: AgreementService = defaultAgreementService,
) {
  const router = Router();
  router.use(authenticate);
  router.use((_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });

  router.get('/projects/:projectId/agreement-versions', async (request, response) => {
    const { projectId } = agreementProjectParamsSchema.parse(request.params);
    const query = listAgreementVersionsQuerySchema.parse(request.query);
    const result = await agreementService.list(
      request.auth!.userId,
      projectId,
      query,
    );
    response.json(result);
  });

  router.post(
    '/projects/:projectId/agreement-versions',
    mutationLimiter,
    async (request, response) => {
      const { projectId } = agreementProjectParamsSchema.parse(request.params);
      const input = createAgreementSchema.parse(request.body);
      const { changeRequestId, ...snapshot } = input;
      const agreement = await agreementService.createDraft(
        request.auth!.userId,
        projectId,
        snapshot,
        changeRequestId,
      );
      response.status(201).json({ data: agreement });
    },
  );

  router.patch(
    '/agreement-versions/:versionId',
    mutationLimiter,
    async (request, response) => {
      const { versionId } = agreementVersionParamsSchema.parse(request.params);
      const changes = updateAgreementSchema.parse(request.body);
      const agreement = await agreementService.updateDraft(
        request.auth!.userId,
        versionId,
        changes,
      );
      response.json({ data: agreement });
    },
  );

  router.post(
    '/agreement-versions/:versionId/submit',
    mutationLimiter,
    async (request, response) => {
      const { versionId } = agreementVersionParamsSchema.parse(request.params);
      const input = submitAgreementSchema.parse(request.body);
      const agreement = await agreementService.submit(
        request.auth!.userId,
        versionId,
        input.expectedActiveVersionId,
      );
      response.json({ data: agreement });
    },
  );

  router.post(
    '/agreement-versions/:versionId/approve',
    mutationLimiter,
    async (request, response) => {
      const { versionId } = agreementVersionParamsSchema.parse(request.params);
      const input = approveAgreementSchema.parse(request.body);
      const agreement = await agreementService.approve(
        request.auth!.userId,
        versionId,
        input.contentHash,
      );
      response.json({ data: agreement });
    },
  );

  router.post(
    '/agreement-versions/:versionId/reject',
    mutationLimiter,
    async (request, response) => {
      const { versionId } = agreementVersionParamsSchema.parse(request.params);
      const input = rejectAgreementSchema.parse(request.body);
      const agreement = await agreementService.reject(
        request.auth!.userId,
        versionId,
        input.reason,
      );
      response.json({ data: agreement });
    },
  );

  return router;
}
