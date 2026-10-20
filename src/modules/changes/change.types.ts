import type { ChangeRequestStatus } from '../../generated/prisma/enums';

export type AgreementComparison = {
  amountRupiah: { before: string; after: string; difference: string };
  deadline: { before: string; after: string };
};

export type ChangeRequestView = {
  id: string;
  projectId: string;
  requestedById: string;
  reason: string;
  baseAgreementVersionId: string;
  proposedVersionId: string | null;
  status: ChangeRequestStatus;
  comparison: AgreementComparison | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ChangeRequestPage = {
  data: ChangeRequestView[];
  nextCursor: string | null;
};
