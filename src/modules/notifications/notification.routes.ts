import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { authenticate } from '../auth/auth.middleware';

export const pushDeviceSchema = z.object({ token: z.string().max(255).regex(/^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]$/), platform: z.enum(['ios', 'android']) }).strict();
export function createNotificationRouter() {
  const router = Router();
  router.use(authenticate);
  router.use(rateLimit({ windowMs: 15 * 60_000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false }));
  router.put('/notifications/device', async (req, res) => {
    const input = pushDeviceSchema.parse(req.body);
    const identity = { userId: req.auth!.userId, sessionId: req.auth!.sessionId, platform: input.platform, enabled: true };
    await prisma.pushDevice.upsert({ where: { token: input.token }, create: { ...identity, token: input.token }, update: identity });
    res.json({ data: { enabled: true } });
  });
  router.delete('/notifications/device', async (req, res) => {
    await prisma.pushDevice.updateMany({ where: { userId: req.auth!.userId, sessionId: req.auth!.sessionId }, data: { enabled: false } });
    res.json({ data: { enabled: false } });
  });
  return router;
}
