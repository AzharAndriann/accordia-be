import type { ChangeRepository } from './change.repository';
import type { CreateChangeRequestInput, ListChangeRequestsQuery } from './change.schema';

export function createChangeService(repository: ChangeRepository) {
  return {
    create(userId: string, projectId: string, input: CreateChangeRequestInput) {
      return repository.create({ userId, projectId, ...input });
    },
    list(userId: string, projectId: string, query: ListChangeRequestsQuery) {
      return repository.list({ userId, projectId, ...query });
    },
  };
}

export type ChangeService = ReturnType<typeof createChangeService>;
