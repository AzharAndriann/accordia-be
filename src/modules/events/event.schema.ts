import { z } from 'zod';

export const eventProjectParamsSchema = z.object({ projectId: z.string().uuid('Project ID tidak valid') }).strict();
export const listEventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().uuid('Cursor tidak valid').optional(),
}).strict();
export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;
