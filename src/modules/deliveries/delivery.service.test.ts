import { describe, expect, test } from 'bun:test';
import { createDeliverySchema } from './delivery.schema';
import { nextRevisionRound } from './delivery.rules';

describe('delivery schema', () => {
  test('memerlukan minimal satu file atau tautan', () => {
    const base = { agreementVersionId: '11111111-1111-4111-8111-111111111111', note: '' };
    expect(createDeliverySchema.safeParse(base).success).toBeFalse();
    expect(createDeliverySchema.safeParse({ ...base, links: ['https://example.com/result'] }).success).toBeTrue();
  });

  test('menolak file duplikat dan lebih dari lima file', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const base = { agreementVersionId: id, note: '' };
    expect(createDeliverySchema.safeParse({ ...base, fileIds: [id, id] }).success).toBeFalse();
    expect(createDeliverySchema.safeParse({ ...base, fileIds: Array.from({ length: 6 }, (_, index) => `11111111-1111-4111-8111-${String(index).padStart(12, '0')}`) }).success).toBeFalse();
  });
});

describe('revision limit', () => {
  test('mengizinkan putaran terakhir tepat sebelum batas', () => {
    expect(nextRevisionRound(1, 2)).toBe(2);
  });

  test('menolak pada batas dan ketika limit nol', () => {
    expect(() => nextRevisionRound(2, 2)).toThrow('Batas revisi telah habis');
    expect(() => nextRevisionRound(0, 0)).toThrow('Batas revisi telah habis');
  });
});
