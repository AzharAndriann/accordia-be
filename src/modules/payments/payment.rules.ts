import type { PaymentSummary } from './payment.types';

export function calculatePaymentSummary(agreementAmount: string, confirmedTotal: string): PaymentSummary {
  const invoice = BigInt(agreementAmount);
  const confirmed = BigInt(confirmedTotal);
  const difference = confirmed - invoice;
  return {
    agreementAmountRupiah: invoice.toString(),
    confirmedTotalRupiah: confirmed.toString(),
    remainingRupiah: difference < 0n ? (-difference).toString() : '0',
    overpaymentRupiah: difference > 0n ? difference.toString() : '0',
    isPaid: confirmed >= invoice,
    isOverpaid: difference > 0n,
  };
}
