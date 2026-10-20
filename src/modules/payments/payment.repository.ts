import { Prisma, type PrismaClient } from '../../generated/prisma/client';
import { DeliveryStatus, FileStatus, PaymentStatus, ProjectRole, ProjectStatus } from '../../generated/prisma/enums';
import { AppError } from '../../shared/errors';
import { hasPrismaErrorCode, withTransactionRetry } from '../../shared/prisma-transaction';
import { calculatePaymentSummary } from './payment.rules';
import type { CreatePaymentInput } from './payment.schema';
import type { PaymentMutation, PaymentPage, PaymentSummary, PaymentView } from './payment.types';

const paymentInclude = { files: { include: { file: true } } } satisfies Prisma.PaymentInclude;
type PaymentRow = Prisma.PaymentGetPayload<{ include: typeof paymentInclude }>;

function toView(row: PaymentRow): PaymentView {
  return {
    id: row.id, projectId: row.projectId, amountRupiah: row.amountRupiah.toString(),
    submittedById: row.submittedById, status: row.status, reviewedById: row.reviewedById,
    note: row.note, rejectionReason: row.rejectionReason, reviewedAt: row.reviewedAt, createdAt: row.createdAt,
    files: row.files.map(({ file }) => ({ id: file.id, originalName: file.originalName, mimeType: file.mimeType, size: file.size, checksum: file.checksum })),
  };
}

async function loadSummary(tx: Prisma.TransactionClient, projectId: string): Promise<PaymentSummary> {
  const [project, confirmed] = await Promise.all([
    tx.project.findUnique({ where: { id: projectId }, select: { activeAgreementVersion: { select: { amountRupiah: true } } } }),
    tx.payment.aggregate({ where: { projectId, status: PaymentStatus.CONFIRMED }, _sum: { amountRupiah: true } }),
  ]);
  const amount = project?.activeAgreementVersion?.amountRupiah;
  if (!amount) throw new AppError(409, 'AGREEMENT_REQUIRED', 'Kesepakatan aktif tidak ditemukan');
  return calculatePaymentSummary(amount.toString(), confirmed._sum.amountRupiah?.toString() ?? '0');
}

export interface PaymentRepository {
  create(input: CreatePaymentInput & { projectId: string; userId: string }): Promise<PaymentMutation>;
  list(input: { projectId: string; userId: string; limit: number; cursor?: string }): Promise<PaymentPage>;
  confirm(input: { paymentId: string; userId: string; now: Date }): Promise<PaymentMutation>;
  reject(input: { paymentId: string; userId: string; reason: string; now: Date }): Promise<PaymentMutation>;
}

export function createPrismaPaymentRepository(database: PrismaClient): PaymentRepository {
  return {
    async create(input) {
      try {
        return await withTransactionRetry(() => database.$transaction(async (tx) => {
          const member = await tx.projectMember.findUnique({
            where: { projectId_userId: { projectId: input.projectId, userId: input.userId } },
            include: { project: { select: { status: true, activeAgreementVersionId: true } } },
          });
          if (!member) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Proyek tidak ditemukan');
          if (member.role !== ProjectRole.CLIENT) throw new AppError(403, 'FORBIDDEN', 'Hanya klien yang dapat mengirim pembayaran');
          if (!member.project.activeAgreementVersionId || member.project.status === ProjectStatus.DRAFT || member.project.status === ProjectStatus.CANCELLED) {
            throw new AppError(409, 'PROJECT_STATE_CONFLICT', 'Status proyek tidak menerima pembayaran');
          }
          const fileIds = [...new Set(input.fileIds)];
          const files = await tx.file.findMany({ where: { id: { in: fileIds }, projectId: input.projectId, status: FileStatus.READY }, select: { id: true } });
          if (files.length !== fileIds.length) throw new AppError(422, 'INVALID_PAYMENT_FILE', 'Bukti pembayaran tidak valid atau berbeda proyek');
          const row = await tx.payment.create({
            data: {
              projectId: input.projectId, submittedById: input.userId, amountRupiah: input.amountRupiah,
              note: input.note, files: { create: fileIds.map((fileId) => ({ fileId })) },
            }, include: paymentInclude,
          });
          return { payment: toView(row), paymentSummary: await loadSummary(tx, input.projectId) };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
      } catch (error) {
        if (hasPrismaErrorCode(error, 'P2002')) throw new AppError(409, 'PAYMENT_FILE_CONFLICT', 'Bukti pembayaran sudah digunakan');
        throw error;
      }
    },

    list(input) {
      return database.$transaction(async (tx) => {
        const member = await tx.projectMember.findUnique({ where: { projectId_userId: { projectId: input.projectId, userId: input.userId } }, select: { id: true } });
        if (!member) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Proyek tidak ditemukan');
        const rows = await tx.payment.findMany({
          where: { projectId: input.projectId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: input.limit + 1,
          ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}), include: paymentInclude,
        });
        const hasMore = rows.length > input.limit;
        const visible = hasMore ? rows.slice(0, input.limit) : rows;
        return { data: visible.map(toView), nextCursor: hasMore ? (visible.at(-1)?.id ?? null) : null, paymentSummary: await loadSummary(tx, input.projectId) };
      });
    },

    confirm(input) {
      return withTransactionRetry(() => database.$transaction(async (tx) => {
        const row = await tx.payment.findUnique({
          where: { id: input.paymentId }, include: { ...paymentInclude, project: { select: { members: { where: { userId: input.userId }, select: { role: true }, take: 1 } } } },
        });
        if (!row || !row.project.members[0]) throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Pembayaran tidak ditemukan');
        if (row.project.members[0].role !== ProjectRole.FREELANCER) throw new AppError(403, 'FORBIDDEN', 'Hanya freelancer yang dapat mengonfirmasi pembayaran');
        if (row.status === PaymentStatus.CONFIRMED) return { payment: toView(row), paymentSummary: await loadSummary(tx, row.projectId) };
        if (row.status !== PaymentStatus.PENDING) throw new AppError(409, 'PAYMENT_CONFLICT', 'Pembayaran tidak pending');
        const updated = await tx.payment.updateMany({
          where: { id: row.id, status: PaymentStatus.PENDING },
          data: { status: PaymentStatus.CONFIRMED, reviewedById: input.userId, reviewedAt: input.now, rejectionReason: null },
        });
        if (updated.count !== 1) throw new AppError(409, 'PAYMENT_CONFLICT', 'Pembayaran telah berubah');
        const paymentSummary = await loadSummary(tx, row.projectId);
        if (paymentSummary.isPaid) {
          const acceptedDelivery = await tx.delivery.findFirst({ where: { projectId: row.projectId, status: DeliveryStatus.ACCEPTED }, select: { id: true } });
          if (acceptedDelivery) await tx.project.update({ where: { id: row.projectId }, data: { status: ProjectStatus.COMPLETED } });
        }
        const payment = await tx.payment.findUniqueOrThrow({ where: { id: row.id }, include: paymentInclude });
        return { payment: toView(payment), paymentSummary };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
    },

    reject(input) {
      return withTransactionRetry(() => database.$transaction(async (tx) => {
        const row = await tx.payment.findUnique({
          where: { id: input.paymentId }, include: { ...paymentInclude, project: { select: { members: { where: { userId: input.userId }, select: { role: true }, take: 1 } } } },
        });
        if (!row || !row.project.members[0]) throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Pembayaran tidak ditemukan');
        if (row.project.members[0].role !== ProjectRole.FREELANCER) throw new AppError(403, 'FORBIDDEN', 'Hanya freelancer yang dapat menolak pembayaran');
        if (row.status === PaymentStatus.REJECTED && row.reviewedById === input.userId) return { payment: toView(row), paymentSummary: await loadSummary(tx, row.projectId) };
        if (row.status !== PaymentStatus.PENDING) throw new AppError(409, 'PAYMENT_CONFLICT', 'Pembayaran tidak pending');
        const updated = await tx.payment.updateMany({
          where: { id: row.id, status: PaymentStatus.PENDING },
          data: { status: PaymentStatus.REJECTED, reviewedById: input.userId, reviewedAt: input.now, rejectionReason: input.reason },
        });
        if (updated.count !== 1) throw new AppError(409, 'PAYMENT_CONFLICT', 'Pembayaran telah berubah');
        const payment = await tx.payment.findUniqueOrThrow({ where: { id: row.id }, include: paymentInclude });
        return { payment: toView(payment), paymentSummary: await loadSummary(tx, row.projectId) };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
    },
  };
}
