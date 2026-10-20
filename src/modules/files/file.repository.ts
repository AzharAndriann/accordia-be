import type { PrismaClient } from '../../generated/prisma/client';
import { FileStatus } from '../../generated/prisma/enums';
import { AppError } from '../../shared/errors';
import type { DownloadableFile, FileView, StoredUpload } from './file.types';

function toView(file: DownloadableFile): FileView {
  const { storageKey: _storageKey, ...view } = file;
  return view;
}

export interface FileRepository {
  assertMember(projectId: string, userId: string): Promise<void>;
  save(projectId: string, userId: string, uploads: StoredUpload[]): Promise<FileView[]>;
  findDownload(fileId: string, userId: string): Promise<DownloadableFile>;
}

export function createPrismaFileRepository(database: PrismaClient): FileRepository {
  return {
    async assertMember(projectId, userId) {
      const member = await database.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId } },
        select: { id: true },
      });
      if (!member) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Proyek tidak ditemukan');
    },

    async save(projectId, userId, uploads) {
      return database.$transaction(async (transaction) => {
        const member = await transaction.projectMember.findUnique({
          where: { projectId_userId: { projectId, userId } },
          select: { id: true },
        });
        if (!member) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Proyek tidak ditemukan');
        const files = [];
        for (const upload of uploads) {
          files.push(await transaction.file.create({
            data: {
              projectId,
              uploaderId: userId,
              storageKey: upload.storageKey,
              originalName: upload.originalName,
              mimeType: upload.mimeType,
              size: upload.size,
              checksum: upload.checksum,
              status: FileStatus.READY,
            },
          }));
        }
        return files.map(toView);
      });
    },

    async findDownload(fileId, userId) {
      const file = await database.file.findFirst({
        where: {
          id: fileId,
          status: FileStatus.READY,
          project: { members: { some: { userId } } },
        },
      });
      if (!file) throw new AppError(404, 'FILE_NOT_FOUND', 'File tidak ditemukan');
      return file;
    },
  };
}
