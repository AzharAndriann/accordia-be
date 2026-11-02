import { z } from 'zod';

export const POLICY_VERSION = '2026-11-02';
export const policies = {
  version: POLICY_VERSION,
  minimumAge: 18,
  terms: {
    title: 'Syarat penggunaan Accordia',
    content: 'Accordia mencatat kerja sama freelancer dan klien yang diundang. Pengguna wajib berusia minimal 18 tahun menurut tanggal lahir yang diberikan, menyatakan mampu membuat kesepakatan, menjaga keamanan akun, dan memasukkan data yang benar. Para pihak bertanggung jawab meninjau ruang lingkup, biaya, tenggat, revisi, pembatalan serta hak karya sebelum menyetujui versi. Pembayaran dicatat dari bukti transfer dan ditinjau freelancer. Pembatalan proyek bersama memerlukan persetujuan pihak lain; pembatalan tidak memindahkan atau mengembalikan dana. Sengketa internal digunakan untuk mengusulkan dan mencatat solusi bersama; aplikasi tidak bertindak sebagai mediator atau lembaga arbitrase. Persetujuan aplikasi bukan layanan tanda tangan elektronik tersertifikasi.',
  },
  privacy: {
    title: 'Kebijakan privasi Accordia',
    content: 'Data yang diproses meliputi nama, email, tanggal lahir yang dinyatakan, peran, catatan persetujuan kebijakan, proyek, kesepakatan, file, bukti pembayaran dan aktivitas. Data digunakan untuk akun dan kolaborasi proyek. Anggota proyek dapat mengakses data proyek bersama. Password disimpan sebagai hash dan akses proyek memerlukan sesi. Jika diaktifkan pengguna, token perangkat dipakai untuk notifikasi melalui Expo, FCM atau APNs. Email undangan diproses melalui Resend kepada alamat tujuan. Jangan mengunggah informasi yang tidak diperlukan. Berkas yang dibagikan atau diunduh para pihak dapat tetap berada pada perangkat mereka. Fitur mandiri penghapusan data belum tersedia pada versi ini. Pengelola deployment bertanggung jawab melengkapi kontak layanan, masa retensi serta informasi operasional sebelum publikasi kepada umum.',
  },
};

export function isAdult(value: string, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return false;
  const year = now.getUTCFullYear() - date.getUTCFullYear();
  const beforeBirthday = now.getUTCMonth() < date.getUTCMonth()
    || (now.getUTCMonth() === date.getUTCMonth() && now.getUTCDate() < date.getUTCDate());
  return year - Number(beforeBirthday) >= 18 && year <= 130;
}

export const consentSchema = z.object({
  birthDate: z.string().refine((value) => isAdult(value), 'Tanggal lahir harus valid dan usia minimal 18 tahun'),
  acceptedTerms: z.literal(true),
  acceptedPrivacy: z.literal(true),
  declaredCapacity: z.literal(true, { message: 'Pernyataan kecakapan wajib disetujui' }),
  termsVersion: z.literal(POLICY_VERSION),
  privacyVersion: z.literal(POLICY_VERSION),
}).strict().transform(({ acceptedTerms: _terms, acceptedPrivacy: _privacy, ...record }) => record);
export type ConsentInput = z.infer<typeof consentSchema>;
