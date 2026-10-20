import type { PrismaClient } from '../../generated/prisma/client';
import { AppError } from '../../shared/errors';
import type { AuditEventPage } from './event.types';

export interface EventRepository {
  list(input: { projectId: string; userId: string; limit: number; cursor?: string }): Promise<AuditEventPage>;
}

export function createPrismaEventRepository(database: PrismaClient): EventRepository {
  return {
    async list(input) {
      const member = await database.projectMember.findUnique({
        where: { projectId_userId: { projectId: input.projectId, userId: input.userId } }, select: { id: true },
      });
      if (!member) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Proyek tidak ditemukan');
      const rows = await database.auditEvent.findMany({
        where: { projectId: input.projectId }, orderBy: [{ serverTime: 'desc' }, { id: 'desc' }], take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        include: { actor: { select: { name: true } } },
      });
      const hasMore = rows.length > input.limit;
      const visible = hasMore ? rows.slice(0, input.limit) : rows;
      return {
        data: visible.map(({ actor, ...event }) => ({ ...event, actorName: actor.name })),
        nextCursor: hasMore ? (visible.at(-1)?.id ?? null) : null,
      };
    },
  };
}
