import type { PrismaClient } from '../../generated/prisma/client';
import { AuditEventType, ProjectRole } from '../../generated/prisma/enums';
import { recordAuditEvent } from '../events/event.audit';
import type { CreateProjectInput } from './project.schema';
import type { ProjectPage, ProjectSummary } from './project.types';

export interface ProjectRepository {
  createWithOwner(userId: string, input: CreateProjectInput): Promise<ProjectSummary>;
  listForUser(
    userId: string,
    pagination: { limit: number; cursor?: string },
  ): Promise<ProjectPage>;
}

export function createPrismaProjectRepository(
  database: PrismaClient,
): ProjectRepository {
  return {
    createWithOwner(userId, input) {
      return database.$transaction(async (transaction) => {
        const project = await transaction.project.create({
          data: {
            ...input,
            creatorId: userId,
          },
        });

        await transaction.projectMember.create({
          data: {
            projectId: project.id,
            userId,
            role: ProjectRole.FREELANCER,
          },
        });

        await recordAuditEvent(transaction, {
          projectId: project.id,
          actorId: userId,
          type: AuditEventType.PROJECT_CREATED,
          entityType: 'Project',
          entityId: project.id,
        });

        return { ...project, role: ProjectRole.FREELANCER };
      });
    },

    async listForUser(userId, pagination) {
      const projects = await database.project.findMany({
        where: { members: { some: { userId } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: pagination.limit + 1,
        ...(pagination.cursor
          ? { cursor: { id: pagination.cursor }, skip: 1 }
          : {}),
        select: {
          id: true,
          title: true,
          description: true,
          creatorId: true,
          status: true,
          activeAgreementVersionId: true,
          createdAt: true,
          updatedAt: true,
          members: {
            where: { userId },
            select: { role: true },
            take: 1,
          },
        },
      });

      const hasMore = projects.length > pagination.limit;
      const visibleProjects = hasMore
        ? projects.slice(0, pagination.limit)
        : projects;
      const data = visibleProjects.map(({ members, ...project }) => ({
        ...project,
        role: members[0]!.role,
      }));

      return {
        data,
        nextCursor: hasMore ? (data.at(-1)?.id ?? null) : null,
      };
    },
  };
}
