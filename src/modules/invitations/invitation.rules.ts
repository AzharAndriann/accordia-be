import { AppError } from '../../shared/errors';

export type InvitationAcceptanceContext = {
  invitation: {
    targetEmail: string;
    acceptedAt: Date | null;
    cancelledAt: Date | null;
    expiresAt: Date;
    project: {
      creatorId: string;
      members: Array<{ userId: string }>;
    };
  } | null;
  user: {
    id: string;
    email: string;
    emailVerifiedAt: Date | null;
  } | null;
};

export function assertInvitationCanBeAccepted(
  context: InvitationAcceptanceContext,
  now: Date,
): asserts context is {
  invitation: NonNullable<InvitationAcceptanceContext['invitation']>;
  user: NonNullable<InvitationAcceptanceContext['user']>;
} {
  const { invitation, user } = context;

  if (!invitation || !user) {
    throw new AppError(404, 'INVITATION_NOT_FOUND', 'Undangan tidak ditemukan');
  }
  if (user.email !== invitation.targetEmail) {
    throw new AppError(
      403,
      'INVITATION_EMAIL_MISMATCH',
      'Undangan bukan untuk akun ini',
    );
  }
  if (invitation.acceptedAt) {
    throw new AppError(409, 'INVITATION_ALREADY_USED', 'Undangan sudah digunakan');
  }
  if (invitation.cancelledAt) {
    throw new AppError(409, 'INVITATION_CANCELLED', 'Undangan sudah dibatalkan');
  }
  if (invitation.expiresAt <= now) {
    throw new AppError(409, 'INVITATION_EXPIRED', 'Undangan sudah kedaluwarsa');
  }
  if (invitation.project.creatorId === user.id) {
    throw new AppError(
      409,
      'CREATOR_CANNOT_JOIN_AS_CLIENT',
      'Pembuat proyek tidak dapat menjadi klien',
    );
  }
  if (invitation.project.members.some((member) => member.userId === user.id)) {
    throw new AppError(
      409,
      'ALREADY_PROJECT_MEMBER',
      'Pengguna sudah menjadi anggota proyek',
    );
  }
  if (invitation.project.members.length >= 2) {
    throw new AppError(
      409,
      'PROJECT_MEMBER_LIMIT_REACHED',
      'Proyek sudah memiliki jumlah anggota maksimum',
    );
  }
}
