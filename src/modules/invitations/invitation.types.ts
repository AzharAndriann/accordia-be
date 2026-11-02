import type { ProjectRole } from '../../generated/prisma/enums';

export type CreatedInvitation = {
  id: string;
  projectId: string;
  targetEmail: string;
  expiresAt: Date;
  createdAt: Date;
  token: string;
};

export type AcceptedInvitation = {
  invitationId: string;
  projectId: string;
  role: ProjectRole;
  acceptedAt: Date;
};

export type PendingInvitation = {
  id: string;
  projectId: string;
  projectTitle: string;
  inviterName: string;
  targetEmail: string;
  expiresAt: Date;
  createdAt: Date;
};

export type PendingInvitationPage = {
  data: PendingInvitation[];
  nextCursor: string | null;
};

export type ProjectInvitationStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'REMOVAL_PENDING'
  | 'REMOVED'
  | 'CANCELLED'
  | 'EXPIRED';

export type MembershipRemovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type ProjectInvitation = {
  id: string;
  projectId: string;
  targetEmail: string;
  status: ProjectInvitationStatus;
  expiresAt: Date;
  acceptedAt: Date | null;
  cancelledAt: Date | null;
  removalStatus: MembershipRemovalStatus | null;
  removalRequestedAt: Date | null;
  removalRespondedAt: Date | null;
  createdAt: Date;
};

export type ProjectInvitationPage = {
  data: ProjectInvitation[];
  nextCursor: string | null;
};

export type CancelledInvitation = {
  id: string;
  projectId: string;
  cancelledAt: Date;
};

export type MembershipRemovalRequest = {
  invitationId: string;
  projectId: string;
  projectTitle: string;
  freelancerName: string;
  requestedAt: Date;
};

export type MembershipRemovalRequestPage = {
  data: MembershipRemovalRequest[];
  nextCursor: string | null;
};

export type MembershipRemovalResult = {
  invitationId: string;
  projectId: string;
  status: 'APPROVED' | 'REJECTED';
  respondedAt: Date;
};
