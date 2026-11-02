import type { PrismaClient } from '../../generated/prisma/client';
import { Prisma } from '../../generated/prisma/client';
import {
  AuditEventType,
  MembershipRemovalStatus,
  ProjectRole,
} from '../../generated/prisma/enums';
import { AppError } from '../../shared/errors';
import {
  hasPrismaErrorCode,
  withTransactionRetry,
} from '../../shared/prisma-transaction';
import { assertInvitationCanBeAccepted } from './invitation.rules';
import type {
  AcceptedInvitation,
  CancelledInvitation,
  MembershipRemovalRequest,
  MembershipRemovalRequestPage,
  MembershipRemovalResult,
  PendingInvitationPage,
  ProjectInvitationPage,
} from './invitation.types';
import { recordAuditEvent } from '../events/event.audit';

type InvitationContext = {
  projectId: string;
  creatorId: string;
  inviterRole: ProjectRole | null;
  memberEmails: string[];
  memberCount: number;
};

export interface InvitationRepository {
  getCreationContext(projectId: string, inviterId: string): Promise<InvitationContext | null>;
  create(input: {
    projectId: string;
    inviterId: string;
    targetEmail: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<{
    id: string;
    projectId: string;
    targetEmail: string;
    expiresAt: Date;
    createdAt: Date;
  }>;
  listPending(input: {
    userId: string;
    limit: number;
    cursor?: string;
    now: Date;
  }): Promise<PendingInvitationPage>;
  listByProject(input: {
    projectId: string;
    inviterId: string;
    limit: number;
    cursor?: string;
    now: Date;
  }): Promise<ProjectInvitationPage>;
  cancel(input: {
    projectId: string;
    invitationId: string;
    inviterId: string;
    now: Date;
  }): Promise<CancelledInvitation>;
  requestRemoval(input: {
    projectId: string;
    invitationId: string;
    inviterId: string;
    now: Date;
  }): Promise<MembershipRemovalRequest>;
  listRemovalRequests(input: {
    userId: string;
    limit: number;
    cursor?: string;
  }): Promise<MembershipRemovalRequestPage>;
  respondRemoval(input: {
    userId: string;
    invitationId: string;
    decision: 'APPROVED' | 'REJECTED';
    now: Date;
  }): Promise<MembershipRemovalResult>;
  accept(input: {
    userId: string;
    tokenHash?: string;
    invitationId?: string;
    now: Date;
  }): Promise<AcceptedInvitation>;
}

export function createPrismaInvitationRepository(
  database: PrismaClient,
): InvitationRepository {
  return {
    async getCreationContext(projectId, inviterId) {
      const project = await database.project.findFirst({
        where: {
          id: projectId,
          members: { some: { userId: inviterId } },
        },
        select: {
          id: true,
          creatorId: true,
          members: {
            select: {
              userId: true,
              role: true,
              user: { select: { email: true } },
            },
          },
        },
      });

      if (!project) return null;
      const inviter = project.members.find((member) => member.userId === inviterId);

      return {
        projectId: project.id,
        creatorId: project.creatorId,
        inviterRole: inviter?.role ?? null,
        memberEmails: project.members.map((member) => member.user.email),
        memberCount: project.members.length,
      };
    },

    create(input) {
      return database.$transaction(async (transaction) => {
        const invitation = await transaction.invitation.create({
          data: input,
          select: {
            id: true,
            projectId: true,
            targetEmail: true,
            expiresAt: true,
            createdAt: true,
          },
        });
        await recordAuditEvent(transaction, {
          projectId: input.projectId,
          actorId: input.inviterId,
          type: AuditEventType.INVITATION_CREATED,
          entityType: 'Invitation',
          entityId: invitation.id,
        });
        return invitation;
      });
    },

    async listPending(input) {
      const user = await database.user.findUnique({
        where: { id: input.userId },
        select: { email: true },
      });
      if (!user) {
        throw new AppError(404, 'USER_NOT_FOUND', 'Pengguna tidak ditemukan');
      }

      const invitations = await database.invitation.findMany({
        where: {
          targetEmail: user.email,
          acceptedAt: null,
          cancelledAt: null,
          expiresAt: { gt: input.now },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        select: {
          id: true,
          projectId: true,
          targetEmail: true,
          expiresAt: true,
          createdAt: true,
          project: { select: { title: true } },
          inviter: { select: { name: true } },
        },
      });
      const hasMore = invitations.length > input.limit;
      const visible = hasMore ? invitations.slice(0, input.limit) : invitations;
      return {
        data: visible.map((invitation) => ({
          id: invitation.id,
          projectId: invitation.projectId,
          projectTitle: invitation.project.title,
          inviterName: invitation.inviter.name,
          targetEmail: invitation.targetEmail,
          expiresAt: invitation.expiresAt,
          createdAt: invitation.createdAt,
        })),
        nextCursor: hasMore ? (visible.at(-1)?.id ?? null) : null,
      };
    },

    async listByProject(input) {
      const project = await database.project.findFirst({
        where: {
          id: input.projectId,
          members: {
            some: { userId: input.inviterId, role: ProjectRole.FREELANCER },
          },
        },
        select: { id: true },
      });
      if (!project) {
        throw new AppError(404, 'PROJECT_NOT_FOUND', 'Proyek tidak ditemukan');
      }

      const invitations = await database.invitation.findMany({
        where: { projectId: input.projectId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        select: {
          id: true,
          projectId: true,
          targetEmail: true,
          expiresAt: true,
          acceptedAt: true,
          cancelledAt: true,
          removalStatus: true,
          removalRequestedAt: true,
          removalRespondedAt: true,
          createdAt: true,
        },
      });
      const hasMore = invitations.length > input.limit;
      const visible = hasMore ? invitations.slice(0, input.limit) : invitations;
      return {
        data: visible.map((invitation) => ({
          ...invitation,
          status: invitation.removalStatus === MembershipRemovalStatus.APPROVED
            ? ('REMOVED' as const)
            : invitation.removalStatus === MembershipRemovalStatus.PENDING
              ? ('REMOVAL_PENDING' as const)
              : invitation.acceptedAt
                ? ('ACCEPTED' as const)
            : invitation.cancelledAt
              ? ('CANCELLED' as const)
              : invitation.expiresAt <= input.now
                ? ('EXPIRED' as const)
                : ('PENDING' as const),
        })),
        nextCursor: hasMore ? (visible.at(-1)?.id ?? null) : null,
      };
    },

    async cancel(input) {
      return database.$transaction(async (transaction) => {
        const invitation = await transaction.invitation.findFirst({
          where: {
            id: input.invitationId,
            projectId: input.projectId,
            inviterId: input.inviterId,
          },
          select: {
            id: true,
            projectId: true,
            acceptedAt: true,
            cancelledAt: true,
            expiresAt: true,
          },
        });
        if (!invitation) {
          throw new AppError(404, 'INVITATION_NOT_FOUND', 'Undangan tidak ditemukan');
        }
        if (invitation.acceptedAt) {
          throw new AppError(409, 'INVITATION_ALREADY_USED', 'Undangan sudah diterima');
        }
        if (invitation.cancelledAt) {
          throw new AppError(409, 'INVITATION_ALREADY_CANCELLED', 'Undangan sudah dibatalkan');
        }
        if (invitation.expiresAt <= input.now) {
          throw new AppError(409, 'INVITATION_EXPIRED', 'Undangan sudah kedaluwarsa');
        }

        const result = await transaction.invitation.updateMany({
          where: {
            id: invitation.id,
            acceptedAt: null,
            cancelledAt: null,
            expiresAt: { gt: input.now },
          },
          data: { cancelledAt: input.now },
        });
        if (result.count !== 1) {
          throw new AppError(409, 'INVITATION_CONFLICT', 'Status undangan telah berubah');
        }
        return {
          id: invitation.id,
          projectId: invitation.projectId,
          cancelledAt: input.now,
        };
      });
    },

    async requestRemoval(input) {
      return database.$transaction(async (transaction) => {
        const invitation = await transaction.invitation.findFirst({
          where: {
            id: input.invitationId,
            projectId: input.projectId,
            inviterId: input.inviterId,
          },
          select: {
            id: true,
            projectId: true,
            targetEmail: true,
            acceptedAt: true,
            removalStatus: true,
            project: { select: { title: true } },
            inviter: { select: { name: true } },
          },
        });
        if (!invitation) {
          throw new AppError(404, 'INVITATION_NOT_FOUND', 'Undangan tidak ditemukan');
        }
        if (!invitation.acceptedAt) {
          throw new AppError(409, 'INVITATION_NOT_ACCEPTED', 'Undangan belum diterima');
        }
        if (invitation.removalStatus === MembershipRemovalStatus.PENDING) {
          throw new AppError(409, 'REMOVAL_ALREADY_PENDING', 'Permintaan pelepasan masih menunggu');
        }
        if (invitation.removalStatus === MembershipRemovalStatus.APPROVED) {
          throw new AppError(409, 'MEMBER_ALREADY_REMOVED', 'Klien sudah keluar dari proyek');
        }

        const target = await transaction.user.findUnique({
          where: { email: invitation.targetEmail },
          select: { id: true },
        });
        if (!target) {
          throw new AppError(404, 'CLIENT_NOT_FOUND', 'Akun klien tidak ditemukan');
        }
        const membership = await transaction.projectMember.findUnique({
          where: {
            projectId_userId: { projectId: input.projectId, userId: target.id },
          },
          select: { role: true },
        });
        if (membership?.role !== ProjectRole.CLIENT) {
          throw new AppError(409, 'CLIENT_NOT_PROJECT_MEMBER', 'Klien bukan anggota proyek');
        }

        await transaction.invitation.update({
          where: { id: invitation.id },
          data: {
            acceptedById: target.id,
            removalStatus: MembershipRemovalStatus.PENDING,
            removalRequestedAt: input.now,
            removalRespondedAt: null,
          },
        });
        return {
          invitationId: invitation.id,
          projectId: invitation.projectId,
          projectTitle: invitation.project.title,
          freelancerName: invitation.inviter.name,
          requestedAt: input.now,
        };
      });
    },

    async listRemovalRequests(input) {
      const user = await database.user.findUnique({
        where: { id: input.userId },
        select: { email: true },
      });
      if (!user) {
        throw new AppError(404, 'USER_NOT_FOUND', 'Pengguna tidak ditemukan');
      }
      const requests = await database.invitation.findMany({
        where: {
          removalStatus: MembershipRemovalStatus.PENDING,
          OR: [
            { acceptedById: input.userId },
            { acceptedById: null, targetEmail: user.email },
          ],
        },
        orderBy: [{ removalRequestedAt: 'desc' }, { id: 'desc' }],
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        select: {
          id: true,
          projectId: true,
          removalRequestedAt: true,
          project: { select: { title: true } },
          inviter: { select: { name: true } },
        },
      });
      const hasMore = requests.length > input.limit;
      const visible = hasMore ? requests.slice(0, input.limit) : requests;
      return {
        data: visible.map((request) => ({
          invitationId: request.id,
          projectId: request.projectId,
          projectTitle: request.project.title,
          freelancerName: request.inviter.name,
          requestedAt: request.removalRequestedAt!,
        })),
        nextCursor: hasMore ? (visible.at(-1)?.id ?? null) : null,
      };
    },

    async respondRemoval(input) {
      return database.$transaction(async (transaction) => {
        const [user, invitation] = await Promise.all([
          transaction.user.findUnique({
            where: { id: input.userId },
            select: { id: true, email: true },
          }),
          transaction.invitation.findUnique({
            where: { id: input.invitationId },
            select: {
              id: true,
              projectId: true,
              targetEmail: true,
              acceptedById: true,
              removalStatus: true,
            },
          }),
        ]);
        if (!user || !invitation) {
          throw new AppError(404, 'REMOVAL_REQUEST_NOT_FOUND', 'Permintaan tidak ditemukan');
        }
        if (
          invitation.targetEmail !== user.email ||
          (invitation.acceptedById && invitation.acceptedById !== user.id)
        ) {
          throw new AppError(403, 'FORBIDDEN', 'Permintaan bukan untuk akun ini');
        }
        if (invitation.removalStatus !== MembershipRemovalStatus.PENDING) {
          throw new AppError(409, 'REMOVAL_REQUEST_RESOLVED', 'Permintaan sudah direspons');
        }

        if (input.decision === 'APPROVED') {
          const removed = await transaction.projectMember.deleteMany({
            where: {
              projectId: invitation.projectId,
              userId: user.id,
              role: ProjectRole.CLIENT,
            },
          });
          if (removed.count !== 1) {
            throw new AppError(409, 'CLIENT_NOT_PROJECT_MEMBER', 'Klien bukan anggota proyek');
          }
        }
        await transaction.invitation.update({
          where: { id: invitation.id },
          data: {
            acceptedById: user.id,
            removalStatus: input.decision,
            removalRespondedAt: input.now,
          },
        });
        return {
          invitationId: invitation.id,
          projectId: invitation.projectId,
          status: input.decision,
          respondedAt: input.now,
        };
      });
    },

    async accept(input) {
      try {
        return await withTransactionRetry(() =>
          database.$transaction(
            async (transaction) => {
              const [invitation, user] = await Promise.all([
                transaction.invitation.findUnique({
                  where: input.invitationId
                    ? { id: input.invitationId }
                    : { tokenHash: input.tokenHash! },
                  include: {
                    project: {
                      select: {
                        creatorId: true,
                        members: { select: { userId: true } },
                      },
                    },
                  },
                }),
                transaction.user.findUnique({
                  where: { id: input.userId },
                  select: { id: true, email: true, emailVerifiedAt: true },
                }),
              ]);

              const context = { invitation, user };
              assertInvitationCanBeAccepted(context, input.now);

              const accepted = await transaction.invitation.updateMany({
                where: {
                  id: context.invitation.id,
                  acceptedAt: null,
                  cancelledAt: null,
                  expiresAt: { gt: input.now },
                },
                data: { acceptedAt: input.now, acceptedById: context.user.id },
              });

              if (accepted.count !== 1) {
                throw new AppError(
                  409,
                  'INVITATION_CONFLICT',
                  'Status undangan telah berubah',
                );
              }

              await transaction.projectMember.create({
                data: {
                  projectId: context.invitation.projectId,
                  userId: context.user.id,
                  role: ProjectRole.CLIENT,
                },
              });

              await recordAuditEvent(transaction, {
                projectId: context.invitation.projectId,
                actorId: input.userId,
                type: AuditEventType.INVITATION_ACCEPTED,
                entityType: 'Invitation',
                entityId: context.invitation.id,
              });

              return {
                invitationId: context.invitation.id,
                projectId: context.invitation.projectId,
                role: ProjectRole.CLIENT,
                acceptedAt: input.now,
              };
            },
            { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
          ),
        );
      } catch (error) {
        if (hasPrismaErrorCode(error, 'P2002')) {
          throw new AppError(
            409,
            'PROJECT_MEMBER_LIMIT_REACHED',
            'Proyek sudah memiliki klien atau pengguna sudah menjadi anggota',
          );
        }
        throw error;
      }
    },
  };
}
