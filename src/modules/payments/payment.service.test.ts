import { describe, expect, test } from 'bun:test';
import { calculatePaymentSummary } from './payment.rules';
import { createPaymentSchema } from './payment.schema';

describe('payment rules', () => {
  test('pending input memakai rupiah penuh positif dan bukti wajib', () => {
    const fileId = '11111111-1111-4111-8111-111111111111';
    expect(createPaymentSchema.parse({ amountRupiah: '003000', fileIds: [fileId] }).amountRupiah).toBe('3000');
    expect(createPaymentSchema.safeParse({ amountRupiah: '0', fileIds: [fileId] }).success).toBeFalse();
    expect(createPaymentSchema.safeParse({ amountRupiah: '3000', fileIds: [] }).success).toBeFalse();
  });

  test('menghitung pembayaran parsial tanpa memasukkan overpayment', () => {
    expect(calculatePaymentSummary('3000000', '1000000')).toEqual({
      agreementAmountRupiah: '3000000', confirmedTotalRupiah: '1000000', remainingRupiah: '2000000',
      overpaymentRupiah: '0', isPaid: false, isOverpaid: false,
    });
  });

  test('menampilkan overpayment tanpa mengubah total asli', () => {
    expect(calculatePaymentSummary('3000000', '3500000')).toEqual({
      agreementAmountRupiah: '3000000', confirmedTotalRupiah: '3500000', remainingRupiah: '0',
      overpaymentRupiah: '500000', isPaid: true, isOverpaid: true,
    });
  });
});
