import { AppError } from '../../shared/errors';
import type { LoginInput, RegisterInput } from './auth.schema';
import type { AuthRepository, AuthUserRecord } from './auth.repository';
import { createSessionTokenData, signAccessToken } from './auth.tokens';
import type { AuthResult, PublicUser } from './auth.types';
import { env } from '../../config/env';

const passwordHashOptions = {
  algorithm: 'argon2id',
  memoryCost: 65_536,
  timeCost: 3,
} as const;

const dummyPasswordHash = Bun.password.hash(
  'dummy-password-used-only-for-timing-equalization',
  passwordHashOptions,
);

function toPublicUser(user: AuthUserRecord): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    emailVerifiedAt: user.emailVerifiedAt,
    createdAt: user.createdAt,
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

function buildAuthResult(
  user: AuthUserRecord,
  sessionId: string,
  refreshToken: string,
): AuthResult {
  return {
    user: toPublicUser(user),
    accessToken: signAccessToken(user.id, sessionId),
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
  };
}

export function createAuthService(repository: AuthRepository) {
  return {
    async register(input: RegisterInput): Promise<AuthResult> {
      const passwordHash = await Bun.password.hash(
        input.password,
        passwordHashOptions,
      );
      const tokenData = createSessionTokenData();

      try {
        const user = await repository.createUserWithSession({
          name: input.name,
          email: input.email,
          role: input.role,
          passwordHash,
          session: tokenData.session,
        });

        return buildAuthResult(user, tokenData.session.id, tokenData.refreshToken);
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw new AppError(409, 'EMAIL_ALREADY_REGISTERED', 'Email sudah terdaftar');
        }

        throw error;
      }
    },

    async login(input: LoginInput): Promise<AuthResult> {
      const user = await repository.findUserByEmail(input.email);
      const passwordMatches = await Bun.password.verify(
        input.password,
        user?.passwordHash ?? (await dummyPasswordHash),
      );

      if (!user || !passwordMatches) {
        throw new AppError(401, 'INVALID_CREDENTIALS', 'Email atau password salah');
      }

      const tokenData = createSessionTokenData();
      await repository.createSession(user.id, tokenData.session);

      return buildAuthResult(user, tokenData.session.id, tokenData.refreshToken);
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
