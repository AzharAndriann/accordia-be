import { describe, expect, test } from 'bun:test';
import { createChangeService } from './change.service';
import type { ChangeRepository } from './change.repository';

describe('change service', () => {
  test('mencatat user, project, alasan, dan versi aktif yang diharapkan', async () => {
    let captured: unknown;
    const repository = {
      create: async (input) => {
        captured = input;
        return {} as never;
      },
      list: async () => ({ data: [], nextCursor: null }),
    } satisfies ChangeRepository;
    const service = createChangeService(repository);
    await service.create('user-id', 'project-id', {
      reason: 'Tambah halaman laporan',
      expectedActiveVersionId: '11111111-1111-4111-8111-111111111111',
    });
    expect(captured).toEqual({
      userId: 'user-id',
      projectId: 'project-id',
      reason: 'Tambah halaman laporan',
      expectedActiveVersionId: '11111111-1111-4111-8111-111111111111',
    });
  });
});
