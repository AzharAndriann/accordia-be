import { describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { UserRole } from '../../generated/prisma/enums';
import { env } from '../../config/env';
import type {
  AuthRepository,
  AuthUserRecord,
  NewSession,
} from './auth.repository';
import { loginSchema, registerSchema } from './auth.schema';
import { createAuthService } from './auth.service';

function createMemoryRepository() {
  let user: AuthUserRecord | null = null;
  const sessions: Array<NewSession & { userId: string }> = [];

  const repository: AuthRepository = {
    async findUserByEmail(email) {
      return user?.email === email ? user : null;
    },

    async createUserWithSession(input) {
      user = {
        id: randomUUID(),
        email: input.email,
        name: input.name,
        role: input.role,
        passwordHash: input.passwordHash,
        emailVerifiedAt: null,
        createdAt: new Date('2026-10-19T00:00:00.000Z'),
      };
      sessions.push({ ...input.session, userId: user.id });
      return user;
    },

    async createSession(userId, session) {
      sessions.push({ ...session, userId });
    },
  };

  return {
    repository,
    sessions,
    getUser: () => user,
  };
}

describe('auth schema', () => {
  test('menormalisasi email dan nama saat register', () => {
    const result = registerSchema.parse({
      name: '  Budi Santoso  ',
      email: '  BUDI@Example.COM ',
      role: UserRole.FREELANCER,
      password: 'password-yang-kuat',
    });

    expect(result.name).toBe('Budi Santoso');
    expect(result.email).toBe('budi@example.com');
    expect(result.role).toBe(UserRole.FREELANCER);
  });

  test('menolak password register yang terlalu pendek', () => {
    expect(() =>
      registerSchema.parse({
        name: 'Budi Santoso',
        email: 'budi@example.com',
        role: UserRole.CLIENT,
        password: 'pendek',
      }),
    ).toThrow();
  });

  test('menolak role akun yang tidak dikenal', () => {
    expect(() =>
      registerSchema.parse({
        name: 'Budi Santoso',
        email: 'budi@example.com',
        role: 'ADMIN',
        password: 'password-yang-kuat',
      }),
    ).toThrow();
  });
});

describe('auth service', () => {
  test('register menyimpan hash Argon2id dan session, bukan password mentah', async () => {
    const memory = createMemoryRepository();
    const service = createAuthService(memory.repository);
    const password = 'password-yang-kuat';

    const result = await service.register({
      name: 'Budi Santoso',
      email: 'budi@example.com',
      role: UserRole.FREELANCER,
      password,
    });
    const storedUser = memory.getUser();

    expect(storedUser?.passwordHash).toStartWith('$argon2id$');
    expect(await Bun.password.verify(password, storedUser!.passwordHash)).toBe(true);
    expect(storedUser?.passwordHash).not.toBe(password);
    expect(memory.sessions).toHaveLength(1);
    expect(memory.sessions[0]?.refreshTokenHash).toHaveLength(64);
    expect(result).not.toHaveProperty('passwordHash');
    expect(result.user.role).toBe(UserRole.FREELANCER);
    expect(result.refreshToken).not.toBe(memory.sessions[0]?.refreshTokenHash);
  });

  test('login membuat session baru dan access token terverifikasi', async () => {
    const memory = createMemoryRepository();
    const service = createAuthService(memory.repository);
    const password = 'password-yang-kuat';

    await service.register({
      name: 'Budi Santoso',
      email: 'budi@example.com',
      role: UserRole.CLIENT,
      password,
    });
    const result = await service.login(
      loginSchema.parse({ email: 'BUDI@example.com', password }),
    );
    const payload = jwt.verify(result.accessToken, env.JWT_SECRET, {
      algorithms: ['HS256'],
      audience: env.JWT_AUDIENCE,
      issuer: env.JWT_ISSUER,
    });

    expect(memory.sessions).toHaveLength(2);
    expect(result.tokenType).toBe('Bearer');
    expect(payload).toMatchObject({
      sub: result.user.id,
      sid: memory.sessions[1]?.id,
      type: 'access',
    });
  });

  test('login memakai error generik untuk akun yang tidak ditemukan', async () => {
    const memory = createMemoryRepository();
    const service = createAuthService(memory.repository);

    await expect(
      service.login({
        email: 'tidak-ada@example.com',
        password: 'password-yang-salah',
      }),
    ).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_CREDENTIALS',
      message: 'Email atau password salah',
    });
  });
});
