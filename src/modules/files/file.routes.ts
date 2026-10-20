import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../shared/errors';
import { authenticate } from '../auth/auth.middleware';
import { createPrismaFileRepository } from './file.repository';
import { fileParamsSchema, fileProjectParamsSchema } from './file.schema';
import { createFileService, type FileService } from './file.service';
import { createFileStorage } from './file.storage';

const uploadLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Terlalu banyak upload, silakan coba lagi nanti' } },
});

const defaultService = createFileService(
  createPrismaFileRepository(prisma),
  createFileStorage(env.UPLOAD_DIR),
);

function contentDisposition(filename: string) {
  const fallback = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export function createFileRouter(service: FileService = defaultService) {
  const router = Router();
  router.use(authenticate);
  router.use((_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });

  router.post('/projects/:projectId/files', uploadLimiter, async (request, response) => {
    const { projectId } = fileProjectParamsSchema.parse(request.params);
    const files = await service.upload(request, request.auth!.userId, projectId);
    response.status(201).json({ data: files });
  });

  router.get('/files/:fileId/download', async (request, response, next) => {
    const { fileId } = fileParamsSchema.parse(request.params);
    const { file, stream } = await service.download(request.auth!.userId, fileId);
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Content-Length', file.size.toString());
    response.setHeader('Content-Disposition', contentDisposition(file.originalName));
    stream.once('error', (error) => {
      if (!response.headersSent) next(new AppError(404, 'FILE_NOT_FOUND', 'File tidak ditemukan'));
      else response.destroy(error);
    });
    stream.pipe(response);
  });

  return router;
}
