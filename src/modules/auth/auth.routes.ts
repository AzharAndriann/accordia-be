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

  router.post('/register', registerLimiter, async (request, response) => {
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
