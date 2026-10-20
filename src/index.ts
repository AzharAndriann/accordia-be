import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './lib/prisma';
import { createFileStorage } from './modules/files/file.storage';

const app = createApp();

void createFileStorage(env.UPLOAD_DIR).cleanupTemporaryFiles().catch((error) => {
  console.error('Cleanup temporary upload gagal', error);
});

const server = app.listen(env.PORT, env.HOST, () => {
  console.log(`Accordia API berjalan di http://${env.HOST}:${env.PORT}`);
});

async function shutdown() {
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
