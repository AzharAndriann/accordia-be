import { AgreementStatus, ProjectRole } from '../../generated/prisma/enums';
import { AppError } from '../../shared/errors';
import type { AgreementRepository } from './agreement.repository';
import {
  agreementSnapshotSchema,
  type AgreementSnapshot,
  type ListAgreementVersionsQuery,
  type UpdateAgreementInput,
} from './agreement.schema';
import { hashAgreementSnapshot } from './agreement.snapshot';

export function createAgreementService(repository: AgreementRepository) {
  return {
    createDraft(
      userId: string,
      projectId: string,
      snapshot: AgreementSnapshot,
      changeRequestId?: string,
    ) {
      return repository.createDraft({
        userId,
        projectId,
        snapshot,
        contentHash: hashAgreementSnapshot(snapshot),
        changeRequestId,
      });
    },

    list(
      userId: string,
      projectId: string,
      query: ListAgreementVersionsQuery,
    ) {
      return repository.listForProject({ userId, projectId, ...query });
    },

    async updateDraft(
      userId: string,
      versionId: string,
      changes: UpdateAgreementInput,
    ) {
      const context = await repository.findEditable(versionId, userId);
      if (!context) {
        throw new AppError(404, 'AGREEMENT_NOT_FOUND', 'Kesepakatan tidak ditemukan');
      }
      if (context.memberRole !== ProjectRole.FREELANCER) {
        throw new AppError(
          403,
          'FORBIDDEN',
          'Hanya freelancer yang dapat mengubah kesepakatan',
        );
      }
      if (context.agreement.status !== AgreementStatus.DRAFT) {
        throw new AppError(409, 'VERSION_CONFLICT', 'Kesepakatan bukan draft');
      }

      const merged = agreementSnapshotSchema.parse({
        scope: context.agreement.scope,
        deliverables: context.agreement.deliverables,
        amountRupiah: context.agreement.amountRupiah,
        deadline: context.agreement.deadline,
        revisionLimit: context.agreement.revisionLimit,
        cancellationTerms: context.agreement.cancellationTerms,
        ipTerms: context.agreement.ipTerms,
        ...changes,
      });

      return repository.updateDraft({
        versionId,
        projectId: context.agreement.projectId,
        userId,
        expectedUpdatedAt: context.agreement.updatedAt,
        changes,
        contentHash: hashAgreementSnapshot(merged),
      });
    },

    submit(
      userId: string,
      versionId: string,
      expectedActiveVersionId: string | null,
    ) {
      return repository.submit({ userId, versionId, expectedActiveVersionId });
    },

    approve(
      userId: string,
      versionId: string,
      contentHash: string,
      now = new Date(),
    ) {
      return repository.approve({ userId, versionId, contentHash, now });
    },

    reject(
      userId: string,
      versionId: string,
      reason: string,
      now = new Date(),
    ) {
      return repository.reject({ userId, versionId, reason, now });
    },
  };
}

export type AgreementService = ReturnType<typeof createAgreementService>;
