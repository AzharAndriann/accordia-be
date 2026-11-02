import type { Prisma } from '../../generated/prisma/client';

export async function queuePush(tx: Prisma.TransactionClient, input: { key: string; userIds: string[]; projectId?: string; invitationId?: string; path: string }) {
  if (!input.userIds.length) return;
  const devices = await tx.pushDevice.findMany({ where: { userId: { in: input.userIds }, enabled: true } });
  if (!devices.length) return;
  await tx.notificationJob.createMany({ skipDuplicates: true, data: devices.map((device) => ({
    key: `${input.key}:${device.id}`, channel: 'PUSH', recipient: device.token,
    userId: device.userId, sessionId: device.sessionId, projectId: input.projectId, invitationId: input.invitationId,
    payload: { title: 'Accordia', body: 'Ada pembaruan di ruang kerjamu. Buka aplikasi untuk melihat detail.', data: { path: input.path } },
  })) });
}

export async function queueInvitation(tx: Prisma.TransactionClient, invitation: { id: string; projectId: string; targetEmail: string }) {
  const deepLink = `accordia://invitations/${invitation.id}`;
  await tx.notificationJob.create({ data: {
    key: `invitation-email:${invitation.id}`, channel: 'EMAIL', recipient: invitation.targetEmail,
    invitationId: invitation.id, projectId: invitation.projectId,
    payload: { subject: 'Undangan proyek Accordia', text: `Kamu diundang ke proyek di Accordia. Buka tautan ini di perangkat yang memasang Accordia:\n${deepLink}\n\nMasuk atau daftar dengan alamat email penerima ini, kemudian tinjau dan terima undangannya. Undangan berlaku 48 jam. Undangan juga tersedia di notifikasi dalam aplikasi.` },
  } });
  const user = await tx.user.findUnique({ where: { email: invitation.targetEmail }, select: { id: true } });
  if (user) await queuePush(tx, { key: `invitation:${invitation.id}`, userIds: [user.id], invitationId: invitation.id, path: `/invitations/${invitation.id}` });
}
