import { z } from 'zod';

const deadlineSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Deadline harus berformat YYYY-MM-DD')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'Deadline tidak valid');

const amountRupiahSchema = z
  .string()
  .regex(/^\d{1,18}$/, 'Nominal harus berupa rupiah penuh maksimal 18 digit')
  .refine((value) => BigInt(value) > 0n, 'Nominal harus lebih dari nol')
  .transform((value) => BigInt(value).toString());

export const agreementSnapshotSchema = z
  .object({
    scope: z.string().trim().min(1, 'Ruang lingkup wajib diisi').max(20_000),
    deliverables: z
      .array(z.string().trim().min(1).max(500))
      .min(1, 'Minimal satu deliverable')
      .max(20, 'Maksimal 20 deliverable')
      .refine(
        (items) => new Set(items).size === items.length,
        'Deliverable tidak boleh duplikat',
      ),
    amountRupiah: amountRupiahSchema,
    deadline: deadlineSchema,
    revisionLimit: z.number().int().min(0).max(100),
    cancellationTerms: z
      .string()
      .trim()
      .min(1, 'Ketentuan pembatalan wajib diisi')
      .max(10_000),
    ipTerms: z
      .string()
      .trim()
      .min(1, 'Ketentuan hak kekayaan intelektual wajib diisi')
      .max(10_000),
  })
  .strict();

export const createAgreementSchema = agreementSnapshotSchema.extend({
  changeRequestId: z.string().uuid('Change request ID tidak valid').optional(),
});

export const updateAgreementSchema = agreementSnapshotSchema
  .partial()
  .refine((input) => Object.keys(input).length > 0, 'Minimal satu field harus diubah');

export const agreementProjectParamsSchema = z
  .object({ projectId: z.string().uuid('Project ID tidak valid') })
  .strict();

export const agreementVersionParamsSchema = z
  .object({ versionId: z.string().uuid('Version ID tidak valid') })
  .strict();

export const listAgreementVersionsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().uuid('Cursor tidak valid').optional(),
  })
  .strict();

export const submitAgreementSchema = z
  .object({
    expectedActiveVersionId: z.string().uuid().nullable(),
  })
  .strict();

export const approveAgreementSchema = z
  .object({
    contentHash: z.string().regex(/^[a-f0-9]{64}$/, 'Content hash tidak valid'),
  })
  .strict();

export const rejectAgreementSchema = z
  .object({
    reason: z.string().trim().min(3, 'Alasan minimal 3 karakter').max(2_000),
  })
  .strict();

export type AgreementSnapshot = z.infer<typeof agreementSnapshotSchema>;
export type CreateAgreementInput = z.infer<typeof createAgreementSchema>;
export type UpdateAgreementInput = z.infer<typeof updateAgreementSchema>;
export type ListAgreementVersionsQuery = z.infer<
  typeof listAgreementVersionsQuerySchema
>;
