import type { Prisma } from '../../generated/prisma/client';
import type { AuditEventType } from '../../generated/prisma/enums';

export type AuditEventView = {
  id: string; projectId: string; actorId: string; actorName: string; type: AuditEventType;
  entityType: string; entityId: string; metadata: Prisma.JsonValue; serverTime: Date;
};
export type AuditEventPage = { data: AuditEventView[]; nextCursor: string | null };
