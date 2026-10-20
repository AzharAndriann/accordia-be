import { describe, expect, test } from 'bun:test';
import { detectMime } from './file.storage';

describe('file signature validation', () => {
  test('mendeteksi PDF, JPEG, dan PNG dari magic bytes', () => {
    expect(detectMime(Buffer.from('%PDF-1.7'))).toBe('application/pdf');
    expect(detectMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(detectMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
  });

  test('menolak isi yang hanya mengaku sebagai file valid', () => {
    expect(detectMime(Buffer.from('not a real pdf'))).toBeNull();
  });
});
