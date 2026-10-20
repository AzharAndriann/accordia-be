import type { PaymentStatus } from '../../generated/prisma/enums';

export type PaymentFileView = { id: string; originalName: string; mimeType: string; size: number; checksum: string };
export type PaymentView = {
  id: string; projectId: string; amountRupiah: string; submittedById: string; status: PaymentStatus;
  reviewedById: string | null; note: string; rejectionReason: string | null; reviewedAt: Date | null;
  createdAt: Date; files: PaymentFileView[];
};
export type PaymentSummary = {
  agreementAmountRupiah: string; confirmedTotalRupiah: string; remainingRupiah: string;
  overpaymentRupiah: string; isPaid: boolean; isOverpaid: boolean;
};
export type PaymentPage = { data: PaymentView[]; nextCursor: string | null; paymentSummary: PaymentSummary };
export type PaymentMutation = { payment: PaymentView; paymentSummary: PaymentSummary };
