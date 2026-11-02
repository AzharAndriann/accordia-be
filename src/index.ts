import { createNotificationWorker } from './modules/notifications/notification.worker';
import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './lib/prisma';
import { createFileStorage } from './modules/files/file.storage';

const app = createApp();
// Optional integrations are injected by the deployment; no .env files are read here.
const worker = createNotificationWorker(prisma, { resendKey: process.env.RESEND_API_KEY, emailFrom: process.env.NOTIFICATION_EMAIL_FROM, expoAccessToken: process.env.EXPO_ACCESS_TOKEN });
let processing = false;
const notificationTimer = setInterval(() => {
  if (process.env.NOTIFICATIONS_ENABLED !== 'true' || processing) return;
  processing = true;
  void worker.tick().catch(() => console.error('Notification worker unavailable')).finally(() => { processing = false; });
}, 15_000);
notificationTimer.unref();

void createFileStorage(env.UPLOAD_DIR).cleanupTemporaryFiles().catch((error) => {
  console.error('Cleanup temporary upload gagal', error);
});

const server = app.listen(env.PORT, env.HOST, () => {
  console.log(`Accordia API berjalan di http://${env.HOST}:${env.PORT}`);
});

async function shutdown() {
  clearInterval(notificationTimer);
  const timer = setTimeout(() => process.exit(1), 10_000);
  timer.unref();

  server.close(async () => {
    await prisma.$disconnect();
    clearTimeout(timer);
    process.exit(0);
  });
}

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
