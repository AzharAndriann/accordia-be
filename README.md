# Accordia Backend

Backend API Accordia menggunakan Bun, Express 5, Prisma 7, PostgreSQL, dan
Swagger UI. Fitur yang tersedia saat ini mencakup health/readiness serta
register dan login berbasis access token dan refresh token, proyek pengguna,
undangan klien sekali pakai, serta kesepakatan berversi dengan persetujuan
freelancer dan klien.

## Menjalankan secara lokal

```bash
bun install
docker compose up -d
bun run db:deploy
bun run db:generate
bun run dev
```

Endpoint yang tersedia:

- `GET http://localhost:3000/api/v1/health`
- `GET http://localhost:3000/api/v1/ready`
- `POST http://localhost:3000/api/v1/auth/register`
- `POST http://localhost:3000/api/v1/auth/login`
- `GET http://localhost:3000/api/v1/projects`
- `POST http://localhost:3000/api/v1/projects`
- `POST http://localhost:3000/api/v1/projects/:projectId/invitations`
- `POST http://localhost:3000/api/v1/invitations/accept`
- `GET http://localhost:3000/api/v1/projects/:projectId/agreement-versions`
- `POST http://localhost:3000/api/v1/projects/:projectId/agreement-versions`
- `PATCH http://localhost:3000/api/v1/agreement-versions/:versionId`
- `POST http://localhost:3000/api/v1/agreement-versions/:versionId/submit`
- `POST http://localhost:3000/api/v1/agreement-versions/:versionId/approve`
- `POST http://localhost:3000/api/v1/agreement-versions/:versionId/reject`
- `GET http://localhost:3000/api/v1/projects/:projectId/change-requests`
- `POST http://localhost:3000/api/v1/projects/:projectId/change-requests`
- `POST http://localhost:3000/api/v1/projects/:projectId/files`
- `GET http://localhost:3000/api/v1/files/:fileId/download`
- `GET http://localhost:3000/api/v1/projects/:projectId/deliveries`
- `POST http://localhost:3000/api/v1/projects/:projectId/deliveries`
- `POST http://localhost:3000/api/v1/deliveries/:deliveryId/accept`
- `POST http://localhost:3000/api/v1/deliveries/:deliveryId/request-revision`
- `GET http://localhost:3000/api/v1/projects/:projectId/payments`
- `POST http://localhost:3000/api/v1/projects/:projectId/payments`
- `POST http://localhost:3000/api/v1/payments/:paymentId/confirm`
- `POST http://localhost:3000/api/v1/payments/:paymentId/reject`
- Swagger UI: `http://localhost:3000/api-docs/`
- OpenAPI JSON: `http://localhost:3000/openapi.json`

Salin `.env.example` menjadi `.env`, lalu ganti `JWT_SECRET` dengan hasil
`openssl rand -hex 32` sebelum menggunakan project di luar development lokal.
Jika API berada di belakang Caddy pada host yang sama, atur `TRUST_PROXY=loopback`.

Contoh register:

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Budi Santoso","email":"budi@example.com","password":"password-yang-kuat"}'
```

Contoh login:

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"budi@example.com","password":"password-yang-kuat"}'
```

Endpoint proyek membutuhkan header access token:

```bash
curl http://localhost:3000/api/v1/projects \
  -H 'Authorization: Bearer ACCESS_TOKEN'
```

Token undangan hanya dikembalikan ketika undangan dibuat dan berlaku selama 48
jam. Simpan atau kirim token melalui kanal aman; database hanya menyimpan hash.
Penerima harus login menggunakan email tujuan yang sudah diverifikasi.

Kesepakatan dibuat sebagai draft oleh freelancer. Setelah disubmit, snapshot
tidak dapat diubah dan kedua anggota proyek harus menyetujui version ID serta
`contentHash` yang sama. Persetujuan kedua mengaktifkan versi tersebut dan
memperbarui status proyek menjadi `ACTIVE` dalam satu transaksi.
