import type { PaymentRepository } from './payment.repository';
import type { CreatePaymentInput, ListPaymentsQuery } from './payment.schema';

export function createPaymentService(repository: PaymentRepository) {
  return {
    create(userId: string, projectId: string, input: CreatePaymentInput) { return repository.create({ userId, projectId, ...input }); },
    list(userId: string, projectId: string, query: ListPaymentsQuery) { return repository.list({ userId, projectId, ...query }); },
    confirm(userId: string, paymentId: string, now = new Date()) { return repository.confirm({ userId, paymentId, now }); },
    reject(userId: string, paymentId: string, reason: string, now = new Date()) { return repository.reject({ userId, paymentId, reason, now }); },
  };
}
export type PaymentService = ReturnType<typeof createPaymentService>;
