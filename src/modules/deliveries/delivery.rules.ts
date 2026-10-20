import { AppError } from '../../shared/errors';

export function nextRevisionRound(used: number, limit: number) {
  if (used >= limit) {
    throw new AppError(409, 'REVISION_LIMIT_REACHED', 'Batas revisi telah habis; buat change request');
  }
  return used + 1;
}
