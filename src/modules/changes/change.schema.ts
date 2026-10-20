import { z } from 'zod';

export const changeProjectParamsSchema = z
  .object({ projectId: z.string().uuid('Project ID tidak valid') })
  .strict();

export const createChangeRequestSchema = z
  .object({
    reason: z.string().trim().min(3, 'Alasan minimal 3 karakter').max(5_000),
    expectedActiveVersionId: z.string().uuid('Versi aktif tidak valid'),
  })
  .strict();

export const listChangeRequestsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().uuid('Cursor tidak valid').optional(),
  })
  .strict();

export type CreateChangeRequestInput = z.infer<typeof createChangeRequestSchema>;
export type ListChangeRequestsQuery = z.infer<typeof listChangeRequestsQuerySchema>;
