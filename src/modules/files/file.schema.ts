import { z } from 'zod';

export const fileProjectParamsSchema = z.object({ projectId: z.string().uuid('Project ID tidak valid') }).strict();
export const fileParamsSchema = z.object({ fileId: z.string().uuid('File ID tidak valid') }).strict();
