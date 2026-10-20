import { z } from 'zod';

const amountSchema = z.string().regex(/^\d{1,18}$/, 'Nominal harus berupa rupiah penuh maksimal 18 digit')
  .refine((value) => BigInt(value) > 0n, 'Nominal harus lebih dari nol')
  .transform((value) => BigInt(value).toString());

export const paymentProjectParamsSchema = z.object({ projectId: z.string().uuid('Project ID tidak valid') }).strict();
export const paymentParamsSchema = z.object({ paymentId: z.string().uuid('Payment ID tidak valid') }).strict();
export const createPaymentSchema = z.object({
  amountRupiah: amountSchema,
  fileIds: z.array(z.string().uuid()).min(1, 'Bukti pembayaran wajib disertakan').max(5).refine((ids) => new Set(ids).size === ids.length, 'File tidak boleh duplikat'),
  note: z.string().trim().max(5_000).default(''),
}).strict();
export const rejectPaymentSchema = z.object({ reason: z.string().trim().min(3).max(2_000) }).strict();
export const listPaymentsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().uuid('Cursor tidak valid').optional(),
}).strict();

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type ListPaymentsQuery = z.infer<typeof listPaymentsQuerySchema>;
