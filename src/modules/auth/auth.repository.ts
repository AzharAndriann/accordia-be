import type { ConsentInput } from './policies';
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
> & { consents?: { termsVersion: string; privacyVersion: string }[] };

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
    consent: ConsentInput;
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
      return database.user.findUnique({ where: { email }, include: { consents: { select: { termsVersion: true, privacyVersion: true } } } });
    },

    createUserWithSession(input) {
      return database.$transaction(async (transaction) => {
        const user = await transaction.user.create({
          data: {
            name: input.name,
            email: input.email,
            role: input.role,
            passwordHash: input.passwordHash,
            consents: { create: { ...input.consent, birthDate: new Date(`${input.consent.birthDate}T00:00:00.000Z`) } },
          },
        });

        await transaction.session.create({
          data: {
            ...input.session,
            userId: user.id,
          },
        });

        return { ...user, consents: [input.consent] };
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
            user: { include: { consents: { select: { termsVersion: true, privacyVersion: true } } } },
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
        await transaction.pushDevice.updateMany({ where: { sessionId: current.id, userId: current.userId, enabled: true }, data: { sessionId: input.nextSession.id } });
        return current.user;
      });
    },
  };
}
