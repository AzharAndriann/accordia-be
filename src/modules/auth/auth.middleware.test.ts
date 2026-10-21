import { describe, expect, mock, test } from 'bun:test';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { AppError } from '../../shared/errors';
import { UserRole } from '../../generated/prisma/enums';
import {
  createAuthenticateMiddleware,
  requireUserRole,
  type SessionStore,
} from './auth.middleware';
import { signAccessToken } from './auth.tokens';

function createRequest(token?: string) {
  return {
    header(name: string) {
      return name.toLowerCase() === 'authorization' && token
        ? `Bearer ${token}`
        : undefined;
    },
  } as Request;
}

describe('authenticate middleware', () => {
  test('menerima access token dengan session aktif', async () => {
    const userId = randomUUID();
    const sessionId = randomUUID();
    const request = createRequest(signAccessToken(userId, sessionId));
    const database: SessionStore = {
      session: {
        async findFirst() {
          return { id: sessionId, user: { role: UserRole.FREELANCER } };
        },
      },
    };
    const next = mock((_error?: unknown) => undefined);

    await createAuthenticateMiddleware(database)(
      request,
      {} as Response,
      next as unknown as NextFunction,
    );

    expect(request.auth).toEqual({
      userId,
      sessionId,
      role: UserRole.FREELANCER,
    });
    expect(next).toHaveBeenCalledWith();
  });

  test('membatasi endpoint berdasarkan role akun', () => {
    const request = {
      auth: {
        userId: randomUUID(),
        sessionId: randomUUID(),
        role: UserRole.CLIENT,
      },
    } as Request;
    const next = mock((_error?: unknown) => undefined);

    requireUserRole(UserRole.FREELANCER)(
      request,
      {} as Response,
      next as unknown as NextFunction,
    );

    expect(next.mock.calls[0]?.[0]).toMatchObject({
      status: 403,
      code: 'ROLE_FORBIDDEN',
    });
  });

  test('menolak token ketika session tidak aktif', async () => {
    const request = createRequest(signAccessToken(randomUUID(), randomUUID()));
    const database: SessionStore = {
      session: {
        async findFirst() {
          return null;
        },
      },
    };
    const next = mock((_error?: unknown) => undefined);

    await createAuthenticateMiddleware(database)(
      request,
      {} as Response,
      next as unknown as NextFunction,
    );

    const error = next.mock.calls[0]?.[0];
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ status: 401, code: 'UNAUTHENTICATED' });
  });

  test('menolak request tanpa bearer token', async () => {
    const request = createRequest();
    const database: SessionStore = {
      session: {
        async findFirst() {
          throw new Error('Database tidak boleh dipanggil');
        },
      },
    };
    const next = mock((_error?: unknown) => undefined);

    await createAuthenticateMiddleware(database)(
      request,
      {} as Response,
      next as unknown as NextFunction,
    );

    expect(next.mock.calls[0]?.[0]).toMatchObject({
      status: 401,
      code: 'UNAUTHENTICATED',
    });
  });

  test('meneruskan kegagalan database sebagai server error', async () => {
    const request = createRequest(signAccessToken(randomUUID(), randomUUID()));
    const databaseError = new Error('database unavailable');
    const database: SessionStore = {
      session: {
        async findFirst() {
          throw databaseError;
        },
      },
    };
    const next = mock((_error?: unknown) => undefined);

    await createAuthenticateMiddleware(database)(
      request,
      {} as Response,
      next as unknown as NextFunction,
    );

    expect(next).toHaveBeenCalledWith(databaseError);
  });
});
