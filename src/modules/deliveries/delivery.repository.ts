import { Prisma, type PrismaClient } from '../../generated/prisma/client';
import { DeliveryStatus, FileStatus, ProjectRole, ProjectStatus } from '../../generated/prisma/enums';
import { AppError } from '../../shared/errors';
import { hasPrismaErrorCode, withTransactionRetry } from '../../shared/prisma-transaction';
import type { CreateDeliveryInput } from './delivery.schema';
import type { DeliveryPage, DeliveryView } from './delivery.types';
import { nextRevisionRound } from './delivery.rules';

const deliveryInclude = {
  files: { include: { file: true } },
  revisionRequest: true,
} satisfies Prisma.DeliveryInclude;
type DeliveryRow = Prisma.DeliveryGetPayload<{ include: typeof deliveryInclude }>;

function toView(row: DeliveryRow): DeliveryView {
  return {
    id: row.id,
    projectId: row.projectId,
    agreementVersionId: row.agreementVersionId,
    submittedById: row.submittedById,
    note: row.note,
    links: row.links,
    status: row.status,
    submittedAt: row.submittedAt,
    reviewedAt: row.reviewedAt,
    files: row.files.map(({ file }) => ({
      id: file.id,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      checksum: file.checksum,
    })),
    revisionRequest: row.revisionRequest && {
      id: row.revisionRequest.id,
      requestedById: row.revisionRequest.requestedById,
      reason: row.revisionRequest.reason,
      roundNumber: row.revisionRequest.roundNumber,
      createdAt: row.revisionRequest.createdAt,
    },
  };
}

export interface DeliveryRepository {
  create(input: CreateDeliveryInput & { projectId: string; userId: string }): Promise<DeliveryView>;
  list(input: { projectId: string; userId: string; limit: number; cursor?: string }): Promise<DeliveryPage>;
  accept(input: { deliveryId: string; userId: string; now: Date }): Promise<DeliveryView>;
  requestRevision(input: { deliveryId: string; userId: string; reason: string; now: Date }): Promise<DeliveryView>;
}

export function createPrismaDeliveryRepository(database: PrismaClient): DeliveryRepository {
  return {
    async create(input) {
      try {
        return await withTransactionRetry(() => database.$transaction(async (tx) => {
          const member = await tx.projectMember.findUnique({
            where: { projectId_userId: { projectId: input.projectId, userId: input.userId } },
            include: { project: { select: { status: true, activeAgreementVersionId: true } } },
          });
          if (!member) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Proyek tidak ditemukan');
          if (member.role !== ProjectRole.FREELANCER) throw new AppError(403, 'FORBIDDEN', 'Hanya freelancer yang dapat mengirim hasil');
          if (member.project.status !== ProjectStatus.ACTIVE) throw new AppError(409, 'PROJECT_STATE_CONFLICT', 'Status proyek tidak menerima penyerahan');
          if (member.project.activeAgreementVersionId !== input.agreementVersionId) {
            throw new AppError(409, 'VERSION_CONFLICT', 'Versi kesepakatan aktif telah berubah');
          }
          const uniqueFileIds = [...new Set(input.fileIds)];
          const files = await tx.file.findMany({
            where: { id: { in: uniqueFileIds }, projectId: input.projectId, status: FileStatus.READY },
            select: { id: true },
          });
          if (files.length !== uniqueFileIds.length) throw new AppError(422, 'INVALID_DELIVERY_FILE', 'File penyerahan tidak valid atau berbeda proyek');
          const pending = await tx.delivery.findFirst({
            where: { projectId: input.projectId, status: DeliveryStatus.PENDING },
            select: { id: true },
          });
          if (pending) throw new AppError(409, 'PENDING_DELIVERY_EXISTS', 'Masih ada penyerahan yang menunggu review');
          const row = await tx.delivery.create({
            data: {
              projectId: input.projectId,
              agreementVersionId: input.agreementVersionId,
              submittedById: input.userId,
              note: input.note,
              links: input.links,
              files: { create: uniqueFileIds.map((fileId) => ({ fileId })) },
            },
            include: deliveryInclude,
          });
          return toView(row);
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
      } catch (error) {
        if (hasPrismaErrorCode(error, 'P2002')) throw new AppError(409, 'DELIVERY_CONFLICT', 'Penyerahan sudah digunakan atau sedang menunggu review');
        throw error;
      }
    },

    async list(input) {
      const member = await database.projectMember.findUnique({
        where: { projectId_userId: { projectId: input.projectId, userId: input.userId } }, select: { id: true },
      });
      if (!member) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Proyek tidak ditemukan');
      const rows = await database.delivery.findMany({
        where: { projectId: input.projectId },
        orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        include: deliveryInclude,
      });
      const hasMore = rows.length > input.limit;
      const visible = hasMore ? rows.slice(0, input.limit) : rows;
      return { data: visible.map(toView), nextCursor: hasMore ? (visible.at(-1)?.id ?? null) : null };
    },

    accept(input) {
      return withTransactionRetry(() => database.$transaction(async (tx) => {
        const row = await tx.delivery.findUnique({
          where: { id: input.deliveryId },
          include: { ...deliveryInclude, project: { select: { members: { where: { userId: input.userId }, select: { role: true }, take: 1 } } } },
        });
        if (!row || !row.project.members[0]) throw new AppError(404, 'DELIVERY_NOT_FOUND', 'Penyerahan tidak ditemukan');
        if (row.project.members[0].role !== ProjectRole.CLIENT) throw new AppError(403, 'FORBIDDEN', 'Hanya klien yang dapat menerima hasil');
        if (row.status === DeliveryStatus.ACCEPTED) return toView(row);
        if (row.status !== DeliveryStatus.PENDING) throw new AppError(409, 'DELIVERY_CONFLICT', 'Penyerahan tidak menunggu review');
        const updated = await tx.delivery.updateMany({
          where: { id: row.id, status: DeliveryStatus.PENDING },
          data: { status: DeliveryStatus.ACCEPTED, reviewedAt: input.now },
        });
        if (updated.count !== 1) throw new AppError(409, 'DELIVERY_CONFLICT', 'Penyerahan telah berubah');
        await tx.project.update({ where: { id: row.projectId }, data: { status: ProjectStatus.DELIVERED } });
        return toView(await tx.delivery.findUniqueOrThrow({ where: { id: row.id }, include: deliveryInclude }));
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
    },

    requestRevision(input) {
      return withTransactionRetry(() => database.$transaction(async (tx) => {
        const row = await tx.delivery.findUnique({
          where: { id: input.deliveryId },
          include: {
            project: { select: {
              members: { where: { userId: input.userId }, select: { role: true }, take: 1 },
              activeAgreementVersion: { select: { revisionLimit: true } },
            } },
          },
        });
        if (!row || !row.project.members[0]) throw new AppError(404, 'DELIVERY_NOT_FOUND', 'Penyerahan tidak ditemukan');
        if (row.project.members[0].role !== ProjectRole.CLIENT) throw new AppError(403, 'FORBIDDEN', 'Hanya klien yang dapat meminta revisi');
        if (row.status !== DeliveryStatus.PENDING) throw new AppError(409, 'DELIVERY_CONFLICT', 'Penyerahan tidak menunggu review');
        const revisionLimit = row.project.activeAgreementVersion?.revisionLimit;
        if (revisionLimit === undefined) throw new AppError(409, 'AGREEMENT_REQUIRED', 'Kesepakatan aktif tidak ditemukan');
        const used = await tx.revisionRequest.count({ where: { delivery: { projectId: row.projectId } } });
        const roundNumber = nextRevisionRound(used, revisionLimit);
        const updated = await tx.delivery.updateMany({
          where: { id: row.id, status: DeliveryStatus.PENDING },
          data: { status: DeliveryStatus.REVISION_REQUESTED, reviewedAt: input.now },
        });
        if (updated.count !== 1) throw new AppError(409, 'DELIVERY_CONFLICT', 'Penyerahan telah berubah');
        await tx.revisionRequest.create({
          data: { deliveryId: row.id, requestedById: input.userId, reason: input.reason, roundNumber },
        });
        return toView(await tx.delivery.findUniqueOrThrow({ where: { id: row.id }, include: deliveryInclude }));
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
    },
  };
}
