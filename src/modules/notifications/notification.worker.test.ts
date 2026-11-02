import { expect, test } from 'bun:test';
import type { PrismaClient, NotificationJob } from '../../generated/prisma/client';
import { createNotificationWorker } from './notification.worker';

function fixture(options: { active?: boolean; member?: boolean; job?: Partial<NotificationJob>; receipt?: boolean } = {}) {
  const job = { id: 'job', key: 'event:device', channel: 'PUSH', recipient: 'ExpoPushToken[test]', userId: 'user', sessionId: 'session', projectId: 'project', invitationId: null, payload: { title: 'Accordia', body: 'Pembaruan', data: { path: '/projects/project/activity' } }, status: 'PENDING', attempts: 0, availableAt: new Date(0), lockedAt: null, receiptId: 'receipt', lastError: null, createdAt: new Date(), ...options.job } as NotificationJob;
  const writes: any[] = [];
  let disabled = false;
  const db = {
    notificationJob: {
      updateMany: async () => ({ count: 1 }),
      findMany: async ({ where }: any) => where.status === 'PENDING' ? options.receipt ? [] : [job] : options.receipt ? [job] : [],
      update: async ({ data }: any) => { writes.push(data); return job; },
    },
    session: { findFirst: async () => options.active === false ? null : { id: 'session' } },
    pushDevice: { findFirst: async () => ({ id: 'device' }), updateMany: async () => { disabled = true; return { count: 1 }; } },
    projectMember: { findUnique: async () => options.member === false ? null : { id: 'member' } },
    invitation: { findUnique: async () => ({ expiresAt: new Date(Date.now() + 60_000), acceptedAt: null, cancelledAt: null }) },
  };
  return { db: db as unknown as PrismaClient, writes, disabled: () => disabled };
}

test('revoked session and removed member never receive queued project push', async () => {
  for (const options of [{ active: false }, { member: false }]) {
    const f = fixture(options);
    let sent = 0;
    await createNotificationWorker(f.db, {}, (async () => { sent++; return Response.json({}); })).tick();
    expect(sent).toBe(0);
    expect(f.writes[0].lastError).toBe('RECIPIENT_NO_LONGER_ELIGIBLE');
  }
});
test('Expo ticket is retained for receipt verification', async () => {
  const f = fixture();
  await createNotificationWorker(f.db, {}, (async () => Response.json({ data: { status: 'ok', id: 'ticket-id' } }))).tick();
  expect(f.writes[0].status).toBe('RECEIPT');
  expect(f.writes[0].receiptId).toBe('ticket-id');
});
test('invalid Expo token is disabled', async () => {
  const f = fixture();
  await createNotificationWorker(f.db, {}, (async () => Response.json({ data: { status: 'error', details: { error: 'DeviceNotRegistered' } } }))).tick();
  expect(f.disabled()).toBe(true);
  expect(f.writes[0].status).toBe('FAILED');
});
test('temporary delivery failure retries without exposing provider response', async () => {
  const f = fixture();
  await createNotificationWorker(f.db, {}, (async () => new Response('private response', { status: 503 }))).tick();
  expect(f.writes[0].status).toBe('PENDING');
  expect(f.writes[0].lastError).toBe('PUSH_HTTP_503');
});
test('receipt failure disables device and marks job failed', async () => {
  const f = fixture({ receipt: true });
  await createNotificationWorker(f.db, {}, (async () => Response.json({ data: { receipt: { status: 'error', details: { error: 'DeviceNotRegistered' } } } }))).tick();
  expect(f.disabled()).toBe(true);
  expect(f.writes[0].status).toBe('FAILED');
});
test('Resend uses a stable idempotency key and text-only invitation', async () => {
  const f = fixture({ job: { channel: 'EMAIL', invitationId: 'invitation', recipient: 'recipient@example.com', payload: { subject: 'Undangan', text: 'accordia://invitations/id' } } });
  let captured: RequestInit | undefined;
  await createNotificationWorker(f.db, { resendKey: 'test-key', emailFrom: 'Accordia <test@example.com>' }, (async (_url, options) => { captured = options; return Response.json({ id: 'sent' }); })).tick();
  expect((captured!.headers as Record<string, string>)['Idempotency-Key']).toBe('job');
  expect(JSON.parse(captured!.body as string).text).toContain('accordia://invitations/');
  expect(f.writes[0].status).toBe('SENT');
});
