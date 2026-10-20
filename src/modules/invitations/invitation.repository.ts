import type { PrismaClient } from '../../generated/prisma/client';
import { Prisma } from '../../generated/prisma/client';
import { AuditEventType, ProjectRole } from '../../generated/prisma/enums';
import { AppError } from '../../shared/errors';
import {
  hasPrismaErrorCode,
  withTransactionRetry,
} from '../../shared/prisma-transaction';
import { assertInvitationCanBeAccepted } from './invitation.rules';
import type { AcceptedInvitation } from './invitation.types';
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
  accept(input: {
    userId: string;
    tokenHash: string;
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

    async accept(input) {
      try {
        return await withTransactionRetry(() =>
          database.$transaction(
            async (transaction) => {
              const [invitation, user] = await Promise.all([
                transaction.invitation.findUnique({
                  where: { tokenHash: input.tokenHash },
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
                  expiresAt: { gt: input.now },
                },
                data: { acceptedAt: input.now },
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
