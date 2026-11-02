import { z } from 'zod';
import { consentSchema } from './policies';
import { UserRole } from '../../generated/prisma/enums';

const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email wajib diisi')
  .max(254, 'Email terlalu panjang')
  .email('Format email tidak valid')
  .transform((email) => email.toLowerCase());

const passwordSchema = z
  .string()
  .min(12, 'Password minimal 12 karakter')
  .max(128, 'Password maksimal 128 karakter');

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Nama minimal 2 karakter')
      .max(100, 'Nama maksimal 100 karakter'),
    email: emailSchema,
    role: z.enum(UserRole),
    password: passwordSchema,
    consent: consentSchema,
  })
  .strict();

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1, 'Password wajib diisi').max(128),
  })
  .strict();

export const refreshSessionSchema = z
  .object({
    refreshToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'Refresh token tidak valid'),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshSessionInput = z.infer<typeof refreshSessionSchema>;
