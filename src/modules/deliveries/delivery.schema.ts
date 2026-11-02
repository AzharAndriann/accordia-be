import { z } from 'zod';

export const deliveryProjectParamsSchema = z.object({ projectId: z.string().uuid('Project ID tidak valid') }).strict();
export const deliveryParamsSchema = z.object({ deliveryId: z.string().uuid('Delivery ID tidak valid') }).strict();

export const createDeliverySchema = z
  .object({
    agreementVersionId: z.string().uuid('Agreement version ID tidak valid'),
    note: z.string().trim().max(5_000).default(''),
    fileIds: z.array(z.string().uuid()).max(5, 'Maksimal 5 file').default([]),
    links: z.array(z.string().url().max(2_000).refine((value) => ['http:', 'https:'].includes(new URL(value).protocol), 'Gunakan tautan http atau https')).max(10, 'Maksimal 10 tautan').default([]),
  })
  .strict()
  .refine((input) => input.fileIds.length > 0 || input.links.length > 0, 'Minimal satu file atau tautan wajib disertakan')
  .refine((input) => new Set(input.fileIds).size === input.fileIds.length, 'File tidak boleh duplikat')
  .refine((input) => new Set(input.links).size === input.links.length, 'Tautan tidak boleh duplikat');

export const requestRevisionSchema = z.object({ reason: z.string().trim().min(3).max(5_000) }).strict();
export const listDeliveriesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().uuid('Cursor tidak valid').optional(),
}).strict();

export type CreateDeliveryInput = z.infer<typeof createDeliverySchema>;
export type ListDeliveriesQuery = z.infer<typeof listDeliveriesQuerySchema>;
