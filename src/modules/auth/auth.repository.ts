import type { PrismaClient, User } from '../../generated/prisma/client';

export type AuthUserRecord = Pick<
  User,
  | 'id'
  | 'email'
  | 'name'
  | 'role'
  | 'passwordHash'
  | 'emailVerifiedAt'
  | 'createdAt'
>;

export type NewSession = {
  id: string;
  refreshTokenHash: string;
  tokenFamilyId: string;
  expiresAt: Date;
};

export interface AuthRepository {
  findUserByEmail(email: string): Promise<AuthUserRecord | null>;
  createUserWithSession(input: {
    name: string;
    email: string;
    role: User['role'];
    passwordHash: string;
    session: NewSession;
  }): Promise<AuthUserRecord>;
  createSession(userId: string, session: NewSession): Promise<void>;
  rotateSession(input: {
    refreshTokenHash: string;
    nextSession: NewSession;
    now: Date;
  }): Promise<AuthUserRecord | null>;
}

export function createPrismaAuthRepository(database: PrismaClient): AuthRepository {
  return {
    findUserByEmail(email) {
      return database.user.findUnique({ where: { email } });
    },

    createUserWithSession(input) {
      return database.$transaction(async (transaction) => {
        const user = await transaction.user.create({
          data: {
            name: input.name,
            email: input.email,
            role: input.role,
            passwordHash: input.passwordHash,
          },
        });

        await transaction.session.create({
          data: {
            ...input.session,
            userId: user.id,
          },
        });

        return user;
      });
    },

    async createSession(userId, session) {
      await database.session.create({
        data: { ...session, userId },
      });
    },

    rotateSession(input) {
      return database.$transaction(async (transaction) => {
        const current = await transaction.session.findFirst({
          where: {
            refreshTokenHash: input.refreshTokenHash,
            revokedAt: null,
            expiresAt: { gt: input.now },
          },
          select: {
            id: true,
            userId: true,
            tokenFamilyId: true,
            user: true,
          },
        });
        if (!current) return null;

        const revoked = await transaction.session.updateMany({
          where: { id: current.id, revokedAt: null },
          data: { revokedAt: input.now },
        });
        if (revoked.count !== 1) return null;

        await transaction.session.create({
          data: {
            ...input.nextSession,
            tokenFamilyId: current.tokenFamilyId,
            userId: current.userId,
          },
        });
        return current.user;
      });
    },
  };
}
