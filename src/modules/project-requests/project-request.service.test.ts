import { describe, expect, test } from 'bun:test';
import type { PrismaClient } from '../../generated/prisma/client';
import { createProjectRequestService } from './project-request.service';

type Row = { id: string; type: string; status: string; reason: string; requestedById: string; respondentId?: string; proposedById: string | null; projectId: string; resolution: string | null; updatedAt: Date; createdAt: Date; resolvedAt: Date | null };
function fixture(withClient = true) {
  const project = { id: 'project', status: withClient ? 'ACTIVE' : 'DRAFT', members: [{ userId: 'A', role: 'FREELANCER' }, ...(withClient ? [{ userId: 'B', role: 'CLIENT' }] : [])] };
  let row: Row | null = null;
  let clock = 1;
  const tx = {
    project: {
      findFirst: async (args: any) => project.members.some((m) => m.userId === args.where.members.some.userId) ? project : null,
      update: async ({ data }: any) => Object.assign(project, data),
    },
    projectMember: { findMany: async () => [] },
    invitation: { updateMany: async () => ({ count: 0 }) },
    auditEvent: { create: async ({ data }: any) => ({ id: 'event', ...data }) },
    projectRequest: {
      findFirst: async () => row && ['OPEN', 'PROPOSED'].includes(row.status) ? row : null,
      create: async ({ data }: any) => { row = { id: 'request', proposedById: null, resolution: null, ...data, status: data.status ?? 'OPEN', updatedAt: new Date(clock++), createdAt: new Date(0) }; return row; },
      findUnique: async () => row && { ...row, project },
      findUniqueOrThrow: async () => row!,
      updateMany: async ({ where, data }: any) => {
        if (!row || row.status !== where.status || row.updatedAt.getTime() !== where.updatedAt.getTime()) return { count: 0 };
        Object.assign(row, data, { updatedAt: new Date(clock++) }); return { count: 1 };
      },
    },
  };
  const service = createProjectRequestService({ $transaction: async (fn: any) => fn(tx) } as unknown as PrismaClient);
  return { service, project, current: () => row!, reply: (user: string, action: 'approve' | 'reject' | 'propose' | 'withdraw', reason = '') => service.respond(user, 'request', { action, reason, expectedUpdatedAt: row!.updatedAt.toISOString() }) };
}

describe('project request workflows', () => {
  test('cancellation requires the other member, then cancels project', async () => {
    const f = fixture();
    await f.service.create('A', 'project', { type: 'CANCELLATION', reason: 'Pekerjaan tidak dapat dilanjutkan' });
    expect(f.project.status).toBe('ACTIVE');
    await expect(f.reply('A', 'approve')).rejects.toMatchObject({ status: 403 });
    await f.reply('B', 'approve');
    expect(f.project.status).toBe('CANCELLED');
    expect(f.current().status).toBe('APPROVED');
    await expect(f.reply('B', 'approve')).rejects.toMatchObject({ status: 409 });
  });
  test('rejection preserves active project', async () => {
    const f = fixture();
    await f.service.create('B', 'project', { type: 'CANCELLATION', reason: 'Ingin membatalkan pekerjaan ini' });
    await f.reply('A', 'reject', 'Pekerjaan masih berjalan');
    expect(f.project.status).toBe('ACTIVE');
    expect(f.current().status).toBe('REJECTED');
  });
  test('draft without client can be cancelled directly', async () => {
    const f = fixture(false);
    await f.service.create('A', 'project', { type: 'CANCELLATION', reason: 'Draft ini tidak digunakan lagi' });
    expect(f.project.status).toBe('CANCELLED');
  });
  test('dispute proposal must be accepted by the other party', async () => {
    const f = fixture();
    await f.service.create('A', 'project', { type: 'DISPUTE', reason: 'Ada perbedaan hasil pekerjaan' });
    await f.reply('B', 'propose', 'Tambahkan satu putaran revisi tanpa biaya');
    await expect(f.reply('B', 'approve')).rejects.toMatchObject({ status: 403 });
    await f.reply('A', 'approve');
    expect(f.current().status).toBe('APPROVED');
    expect(f.project.status).toBe('ACTIVE');
  });
  test('stale proposal cannot be approved; outsiders cannot act', async () => {
    const f = fixture();
    await f.service.create('A', 'project', { type: 'DISPUTE', reason: 'Pembayaran membutuhkan pembahasan' });
    const before = f.current().updatedAt.toISOString();
    await f.reply('B', 'propose', 'Bayar bertahap sesuai kesepakatan baru');
    await expect(f.service.respond('A', 'request', { action: 'approve', reason: '', expectedUpdatedAt: before })).rejects.toMatchObject({ code: 'REQUEST_CONFLICT' });
    await expect(f.reply('C', 'approve')).rejects.toMatchObject({ status: 404 });
    await expect(f.service.create('C', 'project', { type: 'DISPUTE', reason: 'Tidak boleh membaca proyek asing' })).rejects.toMatchObject({ status: 404 });
  });
  test('one unresolved request of each type is permitted', async () => {
    const f = fixture();
    await f.service.create('A', 'project', { type: 'DISPUTE', reason: 'Perlu menyelesaikan masalah proyek' });
    await expect(f.service.create('A', 'project', { type: 'DISPUTE', reason: 'Permintaan yang sama diajukan lagi' })).rejects.toMatchObject({ code: 'REQUEST_PENDING' });
  });
});
