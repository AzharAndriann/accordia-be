import { authenticate } from './auth.middleware';
import { consentSchema, policies } from './policies';
import { Router } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { prisma } from '../../lib/prisma';
import { createPrismaAuthRepository } from './auth.repository';
import { loginSchema, refreshSessionSchema, registerSchema } from './auth.schema';
import { createAuthService, type AuthService } from './auth.service';

const rateLimitResponse = {
  error: {
    code: 'RATE_LIMITED',
    message: 'Terlalu banyak percobaan, silakan coba lagi nanti',
  },
};

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: rateLimitResponse,
});

const loginIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: rateLimitResponse,
});

const loginAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator(request) {
    const email = request.body?.email;
    return typeof email === 'string' && email.length <= 254
      ? `email:${email.trim().toLowerCase()}`
      : `ip:${ipKeyGenerator(request.ip ?? '127.0.0.1')}`;
  },
  message: rateLimitResponse,
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: rateLimitResponse,
});

const defaultAuthService = createAuthService(createPrismaAuthRepository(prisma));

export function createAuthRouter(authService: AuthService = defaultAuthService) {
  const router = Router();

  router.use((_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });

  router.get('/policies', (_request, response) => response.json({ data: policies }));
  router.post('/consent', authenticate, async (request, response) => {
    const input = consentSchema.parse(request.body);
    const result = await prisma.userConsent.upsert({
      where: { userId_termsVersion_privacyVersion: { userId: request.auth!.userId, termsVersion: input.termsVersion, privacyVersion: input.privacyVersion } },
      create: { ...input, userId: request.auth!.userId, birthDate: new Date(`${input.birthDate}T00:00:00.000Z`) },
      update: {},
      select: { termsVersion: true, privacyVersion: true, acceptedAt: true },
    });
    response.json({ data: result });
  });
  router.post('/logout', authenticate, async (request, response) => {
    await prisma.$transaction(async (tx) => {
      const session = await tx.session.findUniqueOrThrow({ where: { id: request.auth!.sessionId }, select: { tokenFamilyId: true } });
      const family = await tx.session.findMany({ where: { userId: request.auth!.userId, tokenFamilyId: session.tokenFamilyId }, select: { id: true } });
      await tx.session.updateMany({ where: { userId: request.auth!.userId, tokenFamilyId: session.tokenFamilyId, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.pushDevice.updateMany({ where: { sessionId: { in: family.map((s) => s.id) } }, data: { enabled: false } });
    });
    response.json({ data: { loggedOut: true } });
  });

  router.post('/register' , registerLimiter, async (request, response) => {
    const input = registerSchema.parse(request.body);
    const result = await authService.register(input);
    response.status(201).json({ data: result });
  });

  router.post(
    '/login',
    loginIpLimiter,
    loginAccountLimiter,
    async (request, response) => {
      const input = loginSchema.parse(request.body);
      const result = await authService.login(input);
      response.json({ data: result });
    },
  );

  router.post('/refresh', refreshLimiter, async (request, response) => {
    const input = refreshSessionSchema.parse(request.body);
    const result = await authService.refresh(input);
    response.json({ data: result });
  });

  return router;
}
