import type { NotificationJob, PrismaClient } from '../../generated/prisma/client';

class DeliveryError extends Error { constructor(public code: string, public retryable = true) { super(code); } }
type Fetch = (input: string, init?: RequestInit) => Promise<Response>;
const EXPO_API = 'https://exp.host/--/api/v2/push';

export function createNotificationWorker(db: PrismaClient, config: { resendKey?: string; emailFrom?: string; expoAccessToken?: string }, send: Fetch = fetch) {
  const expoHeaders = { 'Content-Type': 'application/json', ...(config.expoAccessToken ? { Authorization: `Bearer ${config.expoAccessToken}` } : {}) };
  async function validRecipient(job: NotificationJob) {
    if (job.channel === 'EMAIL' || job.invitationId) {
      const invitation = job.invitationId && await db.invitation.findUnique({ where: { id: job.invitationId } });
      if (!invitation || invitation.acceptedAt || invitation.cancelledAt || invitation.expiresAt <= new Date()) return false;
    }
    if (job.channel === 'PUSH') {
      const [session, device] = await Promise.all([
        db.session.findFirst({ where: { id: job.sessionId!, userId: job.userId!, revokedAt: null, expiresAt: { gt: new Date() } } }),
        db.pushDevice.findFirst({ where: { token: job.recipient, userId: job.userId!, sessionId: job.sessionId!, enabled: true } }),
      ]);
      if (!session || !device) return false;
      if (job.projectId) return Boolean(await db.projectMember.findUnique({ where: { projectId_userId: { projectId: job.projectId, userId: job.userId! } } }));
    }
    return true;
  }
  async function deliver(job: NotificationJob) {
    if (!await validRecipient(job)) return { status: 'SENT', lastError: 'RECIPIENT_NO_LONGER_ELIGIBLE' };
    const payload = job.payload as Record<string, unknown>;
    if (job.channel === 'EMAIL') {
      const response = await send('https://api.resend.com/emails', { method: 'POST', signal: AbortSignal.timeout(15_000), headers: {
        Authorization: `Bearer ${config.resendKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': job.id,
      }, body: JSON.stringify({ from: config.emailFrom, to: [job.recipient], subject: payload.subject, text: payload.text }) });
      if (!response.ok) throw new DeliveryError(`EMAIL_HTTP_${response.status}`, response.status === 429 || response.status >= 500);
      return { status: 'SENT', lastError: null };
    }
    const response = await send(`${EXPO_API}/send`, { method: 'POST', signal: AbortSignal.timeout(15_000), headers: expoHeaders, body: JSON.stringify({ to: job.recipient, sound: 'default', ...payload }) });
    if (!response.ok) throw new DeliveryError(`PUSH_HTTP_${response.status}`, response.status === 429 || response.status >= 500);
    const result = await response.json() as { data?: { status: string; id?: string; details?: { error?: string } } };
    const ticket = result.data;
    if (ticket?.status !== 'ok' || !ticket.id) {
      const code = ticket?.details?.error ?? 'PUSH_INVALID_TICKET';
      if (code === 'DeviceNotRegistered') await db.pushDevice.updateMany({ where: { token: job.recipient }, data: { enabled: false } });
      throw new DeliveryError(code, code === 'MessageRateExceeded');
    }
    return { status: 'RECEIPT', receiptId: ticket.id, availableAt: new Date(Date.now() + 15 * 60_000), lastError: null };
  }
  async function receipts() {
    const jobs = await db.notificationJob.findMany({ where: { status: 'RECEIPT', availableAt: { lte: new Date() } }, take: 100 });
    if (!jobs.length) return;
    const response = await send(`${EXPO_API}/getReceipts`, { method: 'POST', signal: AbortSignal.timeout(15_000), headers: expoHeaders, body: JSON.stringify({ ids: jobs.map((j) => j.receiptId) }) });
    if (!response.ok) return;
    const result = await response.json() as { data: Record<string, { status: string; details?: { error?: string } }> };
    for (const job of jobs) {
      const receipt = result.data[job.receiptId!];
      if (!receipt) {
        const expired = Date.now() - job.createdAt.getTime() > 24 * 60 * 60_000;
        await db.notificationJob.update({ where: { id: job.id }, data: { status: expired ? 'FAILED' : 'RECEIPT', lastError: expired ? 'RECEIPT_EXPIRED' : null, availableAt: new Date(Date.now() + 15 * 60_000) } });
        continue;
      }
      const error = receipt.details?.error;
      if (error === 'DeviceNotRegistered') await db.pushDevice.updateMany({ where: { token: job.recipient }, data: { enabled: false } });
      await db.notificationJob.update({ where: { id: job.id }, data: { status: receipt.status === 'ok' ? 'SENT' : 'FAILED', lastError: receipt.status === 'ok' ? null : error ?? 'PUSH_RECEIPT_ERROR' } });
    }
  }
  return {
    async tick() {
      await db.notificationJob.updateMany({ where: { status: 'PROCESSING', lockedAt: { lt: new Date(Date.now() - 120_000) } }, data: { status: 'PENDING', lockedAt: null } });
      const jobs = await db.notificationJob.findMany({ where: { status: 'PENDING', attempts: { lt: 5 }, availableAt: { lte: new Date() }, ...(!config.resendKey || !config.emailFrom ? { channel: 'PUSH' } : {}) }, take: 20, orderBy: { createdAt: 'asc' } });
      for (const job of jobs) {
        const claim = await db.notificationJob.updateMany({ where: { id: job.id, status: 'PENDING' }, data: { status: 'PROCESSING', lockedAt: new Date(), attempts: { increment: 1 } } });
        if (claim.count !== 1) continue;
        try {
          await db.notificationJob.update({ where: { id: job.id }, data: { ...await deliver(job), lockedAt: null } });
        } catch (error) {
          const attempts = job.attempts + 1;
          await db.notificationJob.update({ where: { id: job.id }, data: { status: error instanceof DeliveryError && !error.retryable || attempts >= 5 ? 'FAILED' : 'PENDING', lockedAt: null, lastError: error instanceof DeliveryError ? error.code : 'DELIVERY_UNAVAILABLE', availableAt: new Date(Date.now() + 30_000 * 2 ** attempts) } });
        }
      }
      await receipts();
    },
  };
}
