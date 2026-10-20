import { Prisma } from '../../generated/prisma/client';
import type { AuditEventType } from '../../generated/prisma/enums';

export function recordAuditEvent(
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
  return transaction.auditEvent.create({
    data: {
      ...input,
      metadata: input.metadata ?? {},
    },
  });
}
