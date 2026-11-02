import type { UserRole } from '../../generated/prisma/enums';

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  needsConsent: boolean;
};

export type AuthResult = {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
};
