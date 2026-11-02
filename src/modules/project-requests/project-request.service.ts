import { Prisma, type PrismaClient } from '../../generated/prisma/client';
import { AppError } from '../../shared/errors';
import { withTransactionRetry } from '../../shared/prisma-transaction';
import { recordAuditEvent } from '../events/event.audit';
import { z } from 'zod';

export const createRequestSchema = z.object({
  type: z.enum(['CANCELLATION', 'DISPUTE']),
  reason: z.string().trim().min(10, 'Alasan minimal 10 karakter').max(5000),
}).strict();
export const respondRequestSchema = z.object({
  action: z.enum(['propose', 'approve', 'reject', 'withdraw']),
  expectedUpdatedAt: z.string().datetime(),
  reason: z.string().trim().max(5000).default(''),
}).strict();

export function assertRequestAction(row: { type: string; status: string; requestedById: string; proposedById: string | null; respondentId: string | null }, userId: string, action: string) {
  if (!['OPEN', 'PROPOSED'].includes(row.status)) throw new AppError(409, 'REQUEST_RESOLVED', 'Permintaan sudah selesai');
  if (![row.requestedById, row.respondentId].includes(userId)) throw new AppError(403, 'FORBIDDEN', 'Bukan pihak pada permintaan ini');
  if (action === 'withdraw' && userId !== row.requestedById) throw new AppError(403, 'FORBIDDEN', 'Hanya pembuat yang dapat menarik permintaan');
  if (row.type === 'CANCELLATION' && action === 'propose') throw new AppError(409, 'INVALID_ACTION', 'Pembatalan dapat disetujui atau ditolak');
  if (action === 'approve' && row.type === 'DISPUTE' && row.status !== 'PROPOSED') throw new AppError(409, 'RESOLUTION_REQUIRED', 'Usulkan solusi terlebih dahulu');
  if (['approve', 'reject'].includes(action)) {
    const author = row.type === 'CANCELLATION' ? row.requestedById : row.proposedById;
    if (userId === author || !author) throw new AppError(403, 'FORBIDDEN', 'Keputusan harus diberikan pihak lain');
  }
}

export function createProjectRequestService(db: PrismaClient) {
  const transact = <T>(callback: (tx: Prisma.TransactionClient) => Promise<T>) => withTransactionRetry(() => db.$transaction(callback, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
  return {
    async list(userId: string, projectId: string, limit: number, cursor?: string) {
      const member = await db.projectMember.findUnique({ where: { projectId_userId: { projectId, userId } } });
      if (!member) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Proyek tidak ditemukan');
      const rows = await db.projectRequest.findMany({ where: { projectId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
      const visible = rows.slice(0, limit);
      return { data: visible, nextCursor: rows.length > limit ? visible.at(-1)!.id : null };
    },
    create(userId: string, projectId: string, input: z.infer<typeof createRequestSchema>) {
      return transact(async (tx) => {
        const project = await tx.project.findFirst({ where: { id: projectId, members: { some: { userId } } }, include: { members: true } });
        if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Proyek tidak ditemukan');
        const member = project.members.find((m) => m.userId === userId)!;
        if (input.type === 'CANCELLATION' && ['CANCELLED', 'COMPLETED'].includes(project.status)) throw new AppError(409, 'PROJECT_STATE_CONFLICT', 'Proyek sudah berakhir');
        const other = project.members.find((m) => m.userId !== userId);
        if (!other && (input.type !== 'CANCELLATION' || project.status !== 'DRAFT' || member.role !== 'FREELANCER')) throw new AppError(409, 'PARTNER_REQUIRED', 'Permintaan ini membutuhkan anggota proyek lain');
        const pending = await tx.projectRequest.findFirst({ where: { projectId, type: input.type, status: { in: ['OPEN', 'PROPOSED'] } } });
        if (pending) throw new AppError(409, 'REQUEST_PENDING', 'Masih ada permintaan sejenis yang belum selesai');
        const row = await tx.projectRequest.create({ data: { ...input, projectId, requestedById: userId, respondentId: other?.userId, status: other ? 'OPEN' : 'APPROVED', resolvedAt: other ? null : new Date() } });
        await recordAuditEvent(tx, { projectId, actorId: userId, type: 'PROJECT_REQUEST_CREATED', entityType: 'ProjectRequest', entityId: row.id, metadata: { requestType: input.type } });
        if (!other) {
          await tx.project.update({ where: { id: projectId }, data: { status: 'CANCELLED' } });
          await tx.invitation.updateMany({ where: { projectId, acceptedAt: null, cancelledAt: null }, data: { cancelledAt: new Date() } });
          await recordAuditEvent(tx, { projectId, actorId: userId, type: 'PROJECT_CANCELLED', entityType: 'Project', entityId: projectId });
        }
        return row;
      });
    },
    respond(userId: string, requestId: string, input: z.infer<typeof respondRequestSchema>) {
      return transact(async (tx) => {
        const row = await tx.projectRequest.findUnique({ where: { id: requestId }, include: { project: { include: { members: true } } } });
        if (!row || !row.project.members.some((m) => m.userId === userId)) throw new AppError(404, 'REQUEST_NOT_FOUND', 'Permintaan tidak ditemukan');
        if (input.expectedUpdatedAt !== row.updatedAt.toISOString()) throw new AppError(409, 'REQUEST_CONFLICT', 'Usulan telah berubah; baca versi terbaru sebelum memutuskan');
        assertRequestAction(row, userId, input.action);
        if (input.action === 'propose' && input.reason.length < 10) throw new AppError(422, 'RESOLUTION_REQUIRED', 'Solusi minimal 10 karakter');
        if (input.action === 'reject' && input.reason.length < 3) throw new AppError(422, 'REASON_REQUIRED', 'Alasan penolakan minimal 3 karakter');
        if (input.action === 'approve' && !row.project.members.some((m) => m.userId === row.requestedById) ) throw new AppError(409, 'MEMBERSHIP_CHANGED', 'Keanggotaan proyek telah berubah');
        const status = input.action === 'propose' ? 'PROPOSED' : input.action === 'withdraw' ? 'WITHDRAWN' : input.action === 'approve' ? 'APPROVED' : row.type === 'DISPUTE' ? 'OPEN' : 'REJECTED';
        const result = await tx.projectRequest.updateMany({ where: { id: row.id, status: row.status, updatedAt: row.updatedAt }, data: {
          status,
          ...(input.action === 'propose' ? { resolution: input.reason, proposedById: userId } : { respondedById: userId, responseReason: input.reason }),
          ...(input.action === 'reject' && row.type === 'DISPUTE' ? { proposedById: null } : {}),
          resolvedAt: ['APPROVED', 'REJECTED', 'WITHDRAWN'].includes(status) ? new Date() : null,
        } });
        if (result.count !== 1) throw new AppError(409, 'REQUEST_CONFLICT', 'Permintaan telah berubah; muat ulang');
        const type = input.action === 'propose' ? 'PROJECT_RESOLUTION_PROPOSED' : input.action === 'withdraw' ? 'PROJECT_REQUEST_WITHDRAWN' : input.action === 'approve' ? 'PROJECT_REQUEST_APPROVED' : 'PROJECT_REQUEST_REJECTED';
        await recordAuditEvent(tx, { projectId: row.projectId, actorId: userId, type, entityType: 'ProjectRequest', entityId: row.id, metadata: { requestType: row.type, reason: input.reason, previousResolution: row.resolution } });
        if (row.type === 'CANCELLATION' && input.action === 'approve') {
          if (['COMPLETED', 'CANCELLED'].includes(row.project.status)) throw new AppError(409, 'PROJECT_STATE_CONFLICT', 'Proyek sudah berakhir');
          await tx.project.update({ where: { id: row.projectId }, data: { status: 'CANCELLED' } });
          await tx.invitation.updateMany({ where: { projectId: row.projectId, acceptedAt: null, cancelledAt: null }, data: { cancelledAt: new Date() } });
          await recordAuditEvent(tx, { projectId: row.projectId, actorId: userId, type: 'PROJECT_CANCELLED', entityType: 'Project', entityId: row.projectId });
        }
        return tx.projectRequest.findUniqueOrThrow({ where: { id: row.id } });
      });
    },
  };
}
