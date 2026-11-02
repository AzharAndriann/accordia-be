import type { RequestHandler } from 'express';
import { prisma } from '../../lib/prisma';
import { POLICY_VERSION } from './policies';
import { AppError } from '../../shared/errors';

export const requireCurrentConsent: RequestHandler = async (req, _res, next) => {
  try {
    const consent = await prisma.userConsent.findUnique({ where: { userId_termsVersion_privacyVersion: { userId: req.auth!.userId, termsVersion: POLICY_VERSION, privacyVersion: POLICY_VERSION } }, select: { id: true } });
    if (!consent) throw new AppError(403, 'CONSENT_REQUIRED', 'Lengkapi persetujuan penggunaan layanan terlebih dahulu');
    next();
  } catch (error) { next(error); }
};
