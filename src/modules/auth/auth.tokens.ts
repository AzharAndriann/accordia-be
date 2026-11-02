import { createHash, randomBytes, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';

export type SessionTokenData = {
  session: {
    id: string;
    refreshTokenHash: string;
    tokenFamilyId: string;
    expiresAt: Date;
  };
  refreshToken: string;
};

export function createSessionTokenData(
  now = new Date(),
  tokenFamilyId = randomUUID(),
): SessionTokenData {
  const refreshToken = randomBytes(32).toString('base64url');
  const expiresAt = new Date(now);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + env.REFRESH_TOKEN_TTL_DAYS);

  return {
    session: {
      id: randomUUID(),
      refreshTokenHash: hashRefreshToken(refreshToken),
      tokenFamilyId,
      expiresAt,
    },
    refreshToken,
  };
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function signAccessToken(userId: string, sessionId: string): string {
  return jwt.sign(
    { type: 'access', sid: sessionId },
    env.JWT_SECRET,
    {
      algorithm: 'HS256',
      audience: env.JWT_AUDIENCE,
      expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
      issuer: env.JWT_ISSUER,
      jwtid: randomUUID(),
      subject: userId,
    },
  );
}

export function verifyAccessToken(token: string): {
  userId: string;
  sessionId: string;
} {
  const payload = jwt.verify(token, env.JWT_SECRET, {
    algorithms: ['HS256'],
    audience: env.JWT_AUDIENCE,
    issuer: env.JWT_ISSUER,
  });

  if (
    typeof payload === 'string' ||
    payload.type !== 'access' ||
    typeof payload.sub !== 'string' ||
    typeof payload.sid !== 'string'
  ) {
    throw new Error('Payload access token tidak valid');
  }

  return { userId: payload.sub, sessionId: payload.sid };
}
