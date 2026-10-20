import type { Request } from 'express';
import type { FileRepository } from './file.repository';
import type { FileStorage } from './file.storage';

export function createFileService(repository: FileRepository, storage: FileStorage) {
  return {
    async upload(request: Request, userId: string, projectId: string) {
      await repository.assertMember(projectId, userId);
      const uploads = await storage.parse(request);
      try {
        return await repository.save(projectId, userId, uploads);
      } catch (error) {
        await Promise.all(uploads.map((upload) => storage.remove(upload.storageKey)));
        throw error;
      }
    },

    async download(userId: string, fileId: string) {
      const file = await repository.findDownload(fileId, userId);
      return { file, stream: storage.open(file.storageKey) };
    },
  };
}

export type FileService = ReturnType<typeof createFileService>;
