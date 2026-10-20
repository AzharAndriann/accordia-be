import type { EventRepository } from './event.repository';
import type { ListEventsQuery } from './event.schema';

export function createEventService(repository: EventRepository) {
  return { list(userId: string, projectId: string, query: ListEventsQuery) { return repository.list({ userId, projectId, ...query }); } };
}
export type EventService = ReturnType<typeof createEventService>;
