import type { DeliveryRepository } from './delivery.repository';
import type { CreateDeliveryInput, ListDeliveriesQuery } from './delivery.schema';

export function createDeliveryService(repository: DeliveryRepository) {
  return {
    create(userId: string, projectId: string, input: CreateDeliveryInput) {
      return repository.create({ userId, projectId, ...input });
    },
    list(userId: string, projectId: string, query: ListDeliveriesQuery) {
      return repository.list({ userId, projectId, ...query });
    },
    accept(userId: string, deliveryId: string, now = new Date()) {
      return repository.accept({ userId, deliveryId, now });
    },
    requestRevision(userId: string, deliveryId: string, reason: string, now = new Date()) {
      return repository.requestRevision({ userId, deliveryId, reason, now });
    },
  };
}
export type DeliveryService = ReturnType<typeof createDeliveryService>;
