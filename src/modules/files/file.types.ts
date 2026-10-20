import type { FileStatus } from '../../generated/prisma/enums';

export type StoredUpload = {
  storageKey: string;
  absolutePath: string;
  originalName: string;
  mimeType: string;
  size: number;
  checksum: string;
};

export type FileView = {
  id: string;
  projectId: string;
  uploaderId: string;
  originalName: string;
  mimeType: string;
  size: number;
  checksum: string;
  status: FileStatus;
  createdAt: Date;
};

export type DownloadableFile = FileView & { storageKey: string };
