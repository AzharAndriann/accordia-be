import type { AgreementVersion, PrismaClient } from '../../generated/prisma/client';
import { Prisma } from '../../generated/prisma/client';
import {
  AgreementStatus,
  ChangeRequestStatus,
  ProjectRole,
  ProjectStatus,
} from '../../generated/prisma/enums';
import { AppError } from '../../shared/errors';
import {
  hasPrismaErrorCode,
  withTransactionRetry,
} from '../../shared/prisma-transaction';
import type {
  AgreementSnapshot,
  UpdateAgreementInput,
} from './agreement.schema';
import { dateToDateString } from './agreement.snapshot';
import type {
  AgreementVersionPage,
  AgreementVersionView,
  EditableAgreementContext,
} from './agreement.types';

type AgreementWithCount = AgreementVersion & {
  _count?: { approvals: number };
};

function toAgreementView(row: AgreementWithCount): AgreementVersionView {
  return {
    id: row.id,
    projectId: row.projectId,
    versionNumber: row.versionNumber,
    status: row.status,
    scope: row.scope,
    deliverables: row.deliverables,
    amountRupiah: row.amountRupiah.toString(),
    deadline: dateToDateString(row.deadline),
    revisionLimit: row.revisionLimit,
    cancellationTerms: row.cancellationTerms,
    ipTerms: row.ipTerms,
    contentHash: row.contentHash,
    baseAgreementVersionId: row.baseAgreementVersionId,
    createdById: row.createdById,
    rejectedById: row.rejectedById,
    rejectionReason: row.rejectionReason,
    reviewedAt: row.reviewedAt,
    approvalCount: row._count?.approvals ?? 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export interface AgreementRepository {
  createDraft(input: {
    projectId: string;
    userId: string;
    snapshot: AgreementSnapshot;
    contentHash: string;
    changeRequestId?: string;
  }): Promise<AgreementVersionView>;
  listForProject(input: {
    projectId: string;
    userId: string;
    limit: number;
    cursor?: string;
  }): Promise<AgreementVersionPage>;
  findEditable(versionId: string, userId: string): Promise<EditableAgreementContext | null>;
  updateDraft(input: {
    versionId: string;
    expectedUpdatedAt: Date;
    changes: UpdateAgreementInput;
    contentHash: string;
  }): Promise<AgreementVersionView>;
  submit(input: {
    versionId: string;
    userId: string;
    expectedActiveVersionId: string | null;
  }): Promise<AgreementVersionView>;
  approve(input: {
    versionId: string;
    userId: string;
    contentHash: string;
    now: Date;
  }): Promise<AgreementVersionView>;
  reject(input: {
    versionId: string;
    userId: string;
    reason: string;
    now: Date;
  }): Promise<AgreementVersionView>;
}

function assertProjectCanChangeAgreement(status: ProjectStatus) {
  if (
    status === ProjectStatus.DELIVERED ||
    status === ProjectStatus.COMPLETED ||
    status === ProjectStatus.CANCELLED
  ) {
    throw new AppError(
      409,
      'PROJECT_STATE_CONFLICT',
      'Status proyek tidak mengizinkan perubahan kesepakatan',
    );
  }
}

export function createPrismaAgreementRepository(
  database: PrismaClient,
): AgreementRepository {
  return {
    async createDraft(input) {
      try {
        return await withTransactionRetry(
          () =>
            database.$transaction(
              async (transaction) => {
                const project = await transaction.project.findFirst({
                  where: {
                    id: input.projectId,
                    members: { some: { userId: input.userId } },
                  },
                  select: {
                    status: true,
                    members: {
                      where: { userId: input.userId },
                      select: { role: true },
                      take: 1,
                    },
                  },
                });

                if (!project) {
                  throw new AppError(404, 'PROJECT_NOT_FOUND', 'Proyek tidak ditemukan');
                }
                if (project.members[0]?.role !== ProjectRole.FREELANCER) {
                  throw new AppError(
                    403,
                    'FORBIDDEN',
                    'Hanya freelancer yang dapat membuat kesepakatan',
                  );
                }
                assertProjectCanChangeAgreement(project.status);

                if (input.changeRequestId) {
                  const changeRequest = await transaction.changeRequest.findFirst({
                    where: { id: input.changeRequestId, projectId: input.projectId },
                    select: {
                      status: true,
                      proposedVersionId: true,
                      baseAgreementVersionId: true,
                    },
                  });
                  if (!changeRequest) {
                    throw new AppError(404, 'CHANGE_REQUEST_NOT_FOUND', 'Permintaan perubahan tidak ditemukan');
                  }
                  if (
                    changeRequest.status !== ChangeRequestStatus.REQUESTED ||
                    changeRequest.proposedVersionId
                  ) {
                    throw new AppError(409, 'CHANGE_REQUEST_CONFLICT', 'Permintaan perubahan sudah diproses');
                  }
                  const currentProject = await transaction.project.findUniqueOrThrow({
                    where: { id: input.projectId },
                    select: { activeAgreementVersionId: true },
                  });
                  if (currentProject.activeAgreementVersionId !== changeRequest.baseAgreementVersionId) {
                    throw new AppError(409, 'VERSION_CONFLICT', 'Versi kesepakatan aktif telah berubah');
                  }
                }

                const latest = await transaction.agreementVersion.aggregate({
                  where: { projectId: input.projectId },
                  _max: { versionNumber: true },
                });
                const version = await transaction.agreementVersion.create({
                  data: {
                    ...input.snapshot,
                    deadline: new Date(`${input.snapshot.deadline}T00:00:00.000Z`),
                    projectId: input.projectId,
                    createdById: input.userId,
                    contentHash: input.contentHash,
                    versionNumber: (latest._max.versionNumber ?? 0) + 1,
                  },
                });

                if (input.changeRequestId) {
                  const linked = await transaction.changeRequest.updateMany({
                    where: {
                      id: input.changeRequestId,
                      status: ChangeRequestStatus.REQUESTED,
                      proposedVersionId: null,
                    },
                    data: {
                      proposedVersionId: version.id,
                      status: ChangeRequestStatus.PROPOSED,
                    },
                  });
                  if (linked.count !== 1) {
                    throw new AppError(409, 'CHANGE_REQUEST_CONFLICT', 'Permintaan perubahan sudah diproses');
                  }
                }

                return toAgreementView(version);
              },
              { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
            ),
          ['P2034', 'P2002'],
        );
      } catch (error) {
        if (hasPrismaErrorCode(error, 'P2002')) {
          throw new AppError(
            409,
            'VERSION_CONFLICT',
            'Nomor versi kesepakatan telah berubah',
          );
        }
        throw error;
      }
    },

    async listForProject(input) {
      const membership = await database.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId: input.projectId,
            userId: input.userId,
          },
        },
        select: { id: true },
      });

      if (!membership) {
        throw new AppError(404, 'PROJECT_NOT_FOUND', 'Proyek tidak ditemukan');
      }

      const versions = await database.agreementVersion.findMany({
        where: { projectId: input.projectId },
        orderBy: [{ versionNumber: 'desc' }, { id: 'desc' }],
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        include: { _count: { select: { approvals: true } } },
      });
      const hasMore = versions.length > input.limit;
      const visible = hasMore ? versions.slice(0, input.limit) : versions;
      const data = visible.map(toAgreementView);

      return {
        data,
        nextCursor: hasMore ? (data.at(-1)?.id ?? null) : null,
      };
    },

    async findEditable(versionId, userId) {
      const version = await database.agreementVersion.findUnique({
        where: { id: versionId },
        include: {
          _count: { select: { approvals: true } },
          project: {
            select: {
              members: {
                where: { userId },
                select: { role: true },
                take: 1,
              },
            },
          },
        },
      });

      if (!version || !version.project.members[0]) return null;
      const { project: _project, ...agreement } = version;

      return {
        agreement: toAgreementView(agreement),
        memberRole: version.project.members[0].role,
      };
    },

    async updateDraft(input) {
      const data = {
        ...input.changes,
        ...(input.changes.deadline
          ? { deadline: new Date(`${input.changes.deadline}T00:00:00.000Z`) }
          : {}),
        contentHash: input.contentHash,
      };
      const updated = await database.agreementVersion.updateMany({
        where: {
          id: input.versionId,
          status: AgreementStatus.DRAFT,
          updatedAt: input.expectedUpdatedAt,
        },
        data,
      });

      if (updated.count !== 1) {
        throw new AppError(
          409,
          'VERSION_CONFLICT',
          'Versi kesepakatan telah berubah',
        );
      }

      const version = await database.agreementVersion.findUniqueOrThrow({
        where: { id: input.versionId },
        include: { _count: { select: { approvals: true } } },
      });
      return toAgreementView(version);
    },

    async submit(input) {
      try {
        return await withTransactionRetry(() =>
          database.$transaction(
            async (transaction) => {
              const version = await transaction.agreementVersion.findUnique({
                where: { id: input.versionId },
                include: {
                  project: {
                    select: {
                      status: true,
                      activeAgreementVersionId: true,
                      members: {
                        where: { userId: input.userId },
                        select: { role: true },
                        take: 1,
                      },
                    },
                  },
                },
              });

              if (!version || !version.project.members[0]) {
                throw new AppError(404, 'AGREEMENT_NOT_FOUND', 'Kesepakatan tidak ditemukan');
              }
              if (version.project.members[0].role !== ProjectRole.FREELANCER) {
                throw new AppError(
                  403,
                  'FORBIDDEN',
                  'Hanya freelancer yang dapat mengajukan kesepakatan',
                );
              }
              if (version.status !== AgreementStatus.DRAFT) {
                throw new AppError(409, 'VERSION_CONFLICT', 'Kesepakatan bukan draft');
              }
              assertProjectCanChangeAgreement(version.project.status);
              if (
                version.project.activeAgreementVersionId !==
                input.expectedActiveVersionId
              ) {
                throw new AppError(
                  409,
                  'VERSION_CONFLICT',
                  'Versi kesepakatan aktif telah berubah',
                );
              }

              const pending = await transaction.agreementVersion.findFirst({
                where: {
                  projectId: version.projectId,
                  status: AgreementStatus.PENDING,
                },
                select: { id: true },
              });
              if (pending) {
                throw new AppError(
                  409,
                  'PENDING_VERSION_EXISTS',
                  'Proyek sudah memiliki kesepakatan yang menunggu persetujuan',
                );
              }

              const submitted = await transaction.agreementVersion.updateMany({
                where: { id: version.id, status: AgreementStatus.DRAFT },
                data: {
                  status: AgreementStatus.PENDING,
                  baseAgreementVersionId: input.expectedActiveVersionId,
                },
              });
              if (submitted.count !== 1) {
                throw new AppError(
                  409,
                  'VERSION_CONFLICT',
                  'Versi kesepakatan telah berubah',
                );
              }

              const result = await transaction.agreementVersion.findUniqueOrThrow({
                where: { id: version.id },
                include: { _count: { select: { approvals: true } } },
              });
              return toAgreementView(result);
            },
            { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
          ),
        );
      } catch (error) {
        if (hasPrismaErrorCode(error, 'P2002')) {
          throw new AppError(
            409,
            'PENDING_VERSION_EXISTS',
            'Proyek sudah memiliki kesepakatan yang menunggu persetujuan',
          );
        }
        throw error;
      }
    },

    approve(input) {
      return withTransactionRetry(() =>
        database.$transaction(
          async (transaction) => {
            const version = await transaction.agreementVersion.findUnique({
              where: { id: input.versionId },
              include: {
                approvals: { select: { userId: true } },
                project: {
                  select: {
                    activeAgreementVersionId: true,
                    members: { select: { userId: true } },
                  },
                },
              },
            });

            if (
              !version ||
              !version.project.members.some((member) => member.userId === input.userId)
            ) {
              throw new AppError(404, 'AGREEMENT_NOT_FOUND', 'Kesepakatan tidak ditemukan');
            }
            const alreadyApproved = version.approvals.some(
              (approval) => approval.userId === input.userId,
            );
            if (version.status === AgreementStatus.ACCEPTED && alreadyApproved) {
              const accepted = await transaction.agreementVersion.findUniqueOrThrow({
                where: { id: version.id },
                include: { _count: { select: { approvals: true } } },
              });
              return toAgreementView(accepted);
            }
            if (version.status !== AgreementStatus.PENDING) {
              throw new AppError(409, 'VERSION_CONFLICT', 'Kesepakatan tidak pending');
            }
            if (version.contentHash !== input.contentHash) {
              throw new AppError(
                409,
                'CONTENT_HASH_MISMATCH',
                'Isi kesepakatan telah berubah',
              );
            }
            if (
              version.project.activeAgreementVersionId !==
              version.baseAgreementVersionId
            ) {
              throw new AppError(
                409,
                'VERSION_CONFLICT',
                'Versi kesepakatan aktif telah berubah',
              );
            }

            if (!alreadyApproved) {
              await transaction.agreementApproval.create({
                data: {
                  versionId: version.id,
                  userId: input.userId,
                  approvedAt: input.now,
                },
              });
            }

            const approvalCount = version.approvals.length + (alreadyApproved ? 0 : 1);
            if (version.project.members.length === 2 && approvalCount === 2) {
              const activated = await transaction.agreementVersion.updateMany({
                where: { id: version.id, status: AgreementStatus.PENDING },
                data: {
                  status: AgreementStatus.ACCEPTED,
                  reviewedAt: input.now,
                },
              });
              const projectUpdated = await transaction.project.updateMany({
                where: {
                  id: version.projectId,
                  activeAgreementVersionId: version.baseAgreementVersionId,
                },
                data: {
                  activeAgreementVersionId: version.id,
                  status: ProjectStatus.ACTIVE,
                },
              });
              if (activated.count !== 1 || projectUpdated.count !== 1) {
                throw new AppError(
                  409,
                  'VERSION_CONFLICT',
                  'Versi kesepakatan telah berubah',
                );
              }
              await transaction.changeRequest.updateMany({
                where: { proposedVersionId: version.id },
                data: { status: ChangeRequestStatus.ACCEPTED },
              });
            }

            const result = await transaction.agreementVersion.findUniqueOrThrow({
              where: { id: version.id },
              include: { _count: { select: { approvals: true } } },
            });
            return toAgreementView(result);
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        ),
      );
    },

    reject(input) {
      return withTransactionRetry(() =>
        database.$transaction(
          async (transaction) => {
            const version = await transaction.agreementVersion.findUnique({
              where: { id: input.versionId },
              include: {
                project: {
                  select: {
                    members: {
                      where: { userId: input.userId },
                      select: { id: true },
                      take: 1,
                    },
                  },
                },
              },
            });
            if (!version || !version.project.members[0]) {
              throw new AppError(404, 'AGREEMENT_NOT_FOUND', 'Kesepakatan tidak ditemukan');
            }
            if (version.status !== AgreementStatus.PENDING) {
              throw new AppError(409, 'VERSION_CONFLICT', 'Kesepakatan tidak pending');
            }

            const rejected = await transaction.agreementVersion.updateMany({
              where: { id: version.id, status: AgreementStatus.PENDING },
              data: {
                status: AgreementStatus.REJECTED,
                rejectedById: input.userId,
                rejectionReason: input.reason,
                reviewedAt: input.now,
              },
            });
            if (rejected.count !== 1) {
              throw new AppError(
                409,
                'VERSION_CONFLICT',
                'Versi kesepakatan telah berubah',
              );
            }

            await transaction.changeRequest.updateMany({
              where: { proposedVersionId: version.id },
              data: { status: ChangeRequestStatus.REJECTED },
            });

            const result = await transaction.agreementVersion.findUniqueOrThrow({
              where: { id: version.id },
              include: { _count: { select: { approvals: true } } },
            });
            return toAgreementView(result);
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        ),
      );
    },
  };
}
