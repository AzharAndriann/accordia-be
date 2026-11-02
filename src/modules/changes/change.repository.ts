import { Prisma, type PrismaClient } from '../../generated/prisma/client';
import { AuditEventType, ProjectRole } from '../../generated/prisma/enums';
import { AppError } from '../../shared/errors';
import type { CreateChangeRequestInput } from './change.schema';
import type { ChangeRequestPage, ChangeRequestView } from './change.types';
import { recordAuditEvent } from '../events/event.audit';
import { withTransactionRetry } from '../../shared/prisma-transaction';

type ChangeRow = Awaited<ReturnType<PrismaClient['changeRequest']['findFirstOrThrow']>>;

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

export interface ChangeRepository {
  create(input: CreateChangeRequestInput & { projectId: string; userId: string }): Promise<ChangeRequestView>;
  list(input: { projectId: string; userId: string; limit: number; cursor?: string }): Promise<ChangeRequestPage>;
}

export function createPrismaChangeRepository(database: PrismaClient): ChangeRepository {
  async function toView(row: ChangeRow): Promise<ChangeRequestView> {
    let comparison = null;
    if (row.proposedVersionId) {
      const [before, after] = await Promise.all([
        database.agreementVersion.findUnique({
          where: { id: row.baseAgreementVersionId },
          select: { amountRupiah: true, deadline: true },
        }),
        database.agreementVersion.findUnique({
          where: { id: row.proposedVersionId },
          select: { amountRupiah: true, deadline: true },
        }),
      ]);
      if (before && after) {
        const beforeAmount = BigInt(before.amountRupiah.toString());
        const afterAmount = BigInt(after.amountRupiah.toString());
        comparison = {
          amountRupiah: {
            before: beforeAmount.toString(),
            after: afterAmount.toString(),
            difference: (afterAmount - beforeAmount).toString(),
          },
          deadline: { before: dateOnly(before.deadline), after: dateOnly(after.deadline) },
        };
      }
    }
    return { ...row, comparison };
  }

  return {
    async create(input) {
      const row = await withTransactionRetry(() => database.$transaction(async (transaction) => {
          const member = await transaction.projectMember.findUnique({
            where: { projectId_userId: { projectId: input.projectId, userId: input.userId } },
            include: { project: { select: { activeAgreementVersionId: true, status: true } } },
          });
          if (!member) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Proyek tidak ditemukan');
          if (member.role !== ProjectRole.CLIENT) throw new AppError(403, 'FORBIDDEN', 'Hanya klien yang dapat meminta perubahan');
          if (member.project.status !== 'ACTIVE') throw new AppError(409, 'PROJECT_STATE_CONFLICT', 'Perubahan hanya tersedia untuk proyek aktif');
          if (!member.project.activeAgreementVersionId) throw new AppError(409, 'AGREEMENT_REQUIRED', 'Proyek belum memiliki kesepakatan aktif');
          if (member.project.activeAgreementVersionId !== input.expectedActiveVersionId) {
            throw new AppError(409, 'VERSION_CONFLICT', 'Versi kesepakatan aktif telah berubah');
          }
          const created = await transaction.changeRequest.create({
            data: { projectId: input.projectId, requestedById: input.userId, reason: input.reason, baseAgreementVersionId: input.expectedActiveVersionId },
          });
          await recordAuditEvent(transaction, {
            projectId: input.projectId, actorId: input.userId,
            type: AuditEventType.CHANGE_REQUEST_CREATED, entityType: 'ChangeRequest', entityId: created.id,
            metadata: { baseAgreementVersionId: input.expectedActiveVersionId },
          });
          return created;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
      return toView(row);
    },

    async list(input) {
      const member = await database.projectMember.findUnique({
        where: { projectId_userId: { projectId: input.projectId, userId: input.userId } },
        select: { id: true },
      });
      if (!member) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Proyek tidak ditemukan');
      const rows = await database.changeRequest.findMany({
        where: { projectId: input.projectId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });
      const hasMore = rows.length > input.limit;
      const visible = hasMore ? rows.slice(0, input.limit) : rows;
      return {
        data: await Promise.all(visible.map(toView)),
        nextCursor: hasMore ? (visible.at(-1)?.id ?? null) : null,
      };
    },
  };
}
