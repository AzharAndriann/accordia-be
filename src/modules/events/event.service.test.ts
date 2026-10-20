import { describe, expect, test } from 'bun:test';
import { listEventsQuerySchema } from './event.schema';

describe('event pagination', () => {
  test('default 20 dan maksimum 100', () => {
    expect(listEventsQuerySchema.parse({}).limit).toBe(20);
    expect(listEventsQuerySchema.parse({ limit: '100' }).limit).toBe(100);
    expect(listEventsQuerySchema.safeParse({ limit: '101' }).success).toBeFalse();
  });
});
