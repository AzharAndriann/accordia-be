import type { DeliveryStatus } from '../../generated/prisma/enums';

export type DeliveryFileView = { id: string; originalName: string; mimeType: string; size: number; checksum: string };
export type RevisionView = { id: string; requestedById: string; reason: string; roundNumber: number; createdAt: Date };
export type DeliveryView = {
  id: string;
  projectId: string;
  agreementVersionId: string;
  submittedById: string;
  note: string;
  links: string[];
  status: DeliveryStatus;
  submittedAt: Date;
  reviewedAt: Date | null;
  files: DeliveryFileView[];
  revisionRequest: RevisionView | null;
};
export type DeliveryPage = { data: DeliveryView[]; nextCursor: string | null };
