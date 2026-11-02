import { queuePush } from '../notifications/notification.outbox';
import { Prisma } from '../../generated/prisma/client';
import type { AuditEventType } from '../../generated/prisma/enums';

export async function recordAuditEvent(
  transaction: Prisma.TransactionClient,
  input: {
    projectId: string;
    actorId: string;
    type: AuditEventType;
    entityType: string;
    entityId: string;
    metadata?: Prisma.InputJsonObject;
  },
) {
  const event = await transaction.auditEvent.create({
    data: {
      ...input,
      metadata: input.metadata ?? {},
    },
  });
  const members = await transaction.projectMember.findMany({ where: { projectId: input.projectId, userId: { not: input.actorId } }, select: { userId: true } });
  await queuePush(transaction, { key: `event:${event.id}`, userIds: members.map((m) => m.userId), projectId: input.projectId, path: `/projects/${input.projectId}/activity` });
  return event;
}
