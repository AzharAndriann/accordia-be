import { z } from 'zod';

export const invitationProjectParamsSchema = z
  .object({
    projectId: z.string().uuid('Project ID tidak valid'),
  })
  .strict();

export const invitationParamsSchema = z
  .object({
    invitationId: z.string().uuid('Invitation ID tidak valid'),
  })
  .strict();

export const listInvitationsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().uuid('Cursor tidak valid').optional(),
  })
  .strict();

export const createInvitationSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, 'Email wajib diisi')
      .max(254, 'Email terlalu panjang')
      .email('Format email tidak valid')
      .transform((email) => email.toLowerCase()),
  })
  .strict();

export const acceptInvitationSchema = z
  .object({
    token: z
      .string()
      .regex(/^[A-Za-z0-9_-]{43}$/, 'Token undangan tidak valid'),
  })
  .strict();

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
export type ListInvitationsQuery = z.infer<typeof listInvitationsQuerySchema>;
