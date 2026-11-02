import Busboy from 'busboy';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readdir, rename, stat, unlink } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { Request } from 'express';
import { AppError } from '../../shared/errors';
import type { StoredUpload } from './file.types';

export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const MAX_FILES = 5;
const MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const STORAGE_KEY = /^[0-9a-f-]{36}$/;

export function detectMime(header: Buffer): string | null {
  if (header.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  if (header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) return 'image/jpeg';
  if (header.length >= 8 && header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  return null;
}

function safeOriginalName(value: string) {
  const cleaned = basename(value).replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return (cleaned || 'file').slice(0, 255);
}

export function createFileStorage(uploadDirectory: string) {
  const root = resolve(uploadDirectory);
  const temporaryRoot = resolve(root, '.tmp');

  function pathFor(storageKey: string) {
    if (!STORAGE_KEY.test(storageKey)) throw new AppError(500, 'INVALID_STORAGE_KEY', 'File tidak tersedia');
    const target = resolve(root, storageKey);
    if (!target.startsWith(`${root}/`)) throw new AppError(500, 'INVALID_STORAGE_KEY', 'File tidak tersedia');
    return target;
  }

  return {
    async parse(request: Request): Promise<StoredUpload[]> {
      if (!request.headers['content-type']?.toLowerCase().startsWith('multipart/form-data')) {
        throw new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Gunakan multipart/form-data');
      }
      await mkdir(temporaryRoot, { recursive: true });
      await mkdir(root, { recursive: true });
      const uploads: StoredUpload[] = [];
      const tasks: Promise<void>[] = [];
      let parserError: Error | null = null;

      const parser = Busboy({ headers: request.headers, limits: { files: MAX_FILES, fileSize: MAX_FILE_SIZE + 1 } });
      parser.on('file', (field, stream, info) => {
        if (field !== 'files') {
          stream.resume();
          parserError ??= new AppError(422, 'INVALID_FILE_FIELD', 'Field upload harus bernama files');
          return;
        }
        const storageKey = randomUUID();
        const temporaryPath = resolve(temporaryRoot, storageKey);
        const absolutePath = pathFor(storageKey);
        const hash = createHash('sha256');
        let size = 0;
        let limited = false;
        const headerChunks: Buffer[] = [];
        let headerSize = 0;
        stream.on('limit', () => { limited = true; });

        const observer = new Transform({
          transform(chunk: Buffer, _encoding, callback) {
            size += chunk.length;
            hash.update(chunk);
            if (headerSize < 16) {
              const part = chunk.subarray(0, 16 - headerSize);
              headerChunks.push(part);
              headerSize += part.length;
            }
            callback(null, chunk);
          },
        });

        tasks.push((async () => {
          try {
            await pipeline(stream, observer, createWriteStream(temporaryPath, { flags: 'wx', mode: 0o600 }));
            if (limited || size > MAX_FILE_SIZE) throw new AppError(413, 'FILE_TOO_LARGE', 'Ukuran file maksimal 10 MiB');
            if (size === 0) throw new AppError(422, 'EMPTY_FILE', 'File tidak boleh kosong');
            const actualMime = detectMime(Buffer.concat(headerChunks));
            if (!MIME_TYPES.has(info.mimeType) || actualMime !== info.mimeType) {
              throw new AppError(422, 'INVALID_FILE_TYPE', 'File harus berupa PDF, JPEG, atau PNG yang valid');
            }
            await rename(temporaryPath, absolutePath);
            uploads.push({
              storageKey,
              absolutePath,
              originalName: safeOriginalName(info.filename ?? 'file'),
              mimeType: actualMime,
              size,
              checksum: hash.digest('hex'),
            });
          } catch (error) {
            await unlink(temporaryPath).catch(() => undefined);
            throw error;
          }
        })());
      });
      parser.on('filesLimit', () => { parserError ??= new AppError(422, 'TOO_MANY_FILES', 'Maksimal 5 file per upload'); });
      parser.on('error', (error) => {
        parserError ??= error instanceof Error ? error : new Error('Multipart upload gagal');
      });

      try {
        await new Promise<void>((resolvePromise, reject) => {
          parser.once('close', resolvePromise);
          request.once('aborted', () => reject(new AppError(400, 'UPLOAD_ABORTED', 'Upload dibatalkan')));
          request.pipe(parser);
        });
        const results = await Promise.allSettled(tasks);
        const failed = results.find((result) => result.status === 'rejected');
        if (failed?.status === 'rejected') throw failed.reason;
        if (parserError) throw parserError;
        if (uploads.length === 0) throw new AppError(422, 'FILE_REQUIRED', 'Minimal satu file wajib diunggah');
        return uploads;
      } catch (error) {
        await Promise.all(uploads.map((upload) => unlink(upload.absolutePath).catch(() => undefined)));
        throw error;
      }
    },

    open(storageKey: string) {
      return createReadStream(pathFor(storageKey));
    },

    remove(storageKey: string) {
      return unlink(pathFor(storageKey)).catch(() => undefined);
    },

    async cleanupTemporaryFiles(olderThan = new Date(Date.now() - 24 * 60 * 60_000)) {
      await mkdir(temporaryRoot, { recursive: true });
      const entries = await readdir(temporaryRoot, { withFileTypes: true });
      let removed = 0;
      for (const entry of entries) {
        if (!entry.isFile() || !STORAGE_KEY.test(entry.name)) continue;
        const target = resolve(temporaryRoot, entry.name);
        const metadata = await stat(target);
        if (metadata.mtime < olderThan) {
          await unlink(target);
          removed += 1;
        }
      }
      return removed;
    },
  };
}

export type FileStorage = ReturnType<typeof createFileStorage>;
