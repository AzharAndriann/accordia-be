import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  JWT_SECRET: z.string().min(32),
  JWT_ISSUER: z.string().min(1).default('accordia-api'),
  JWT_AUDIENCE: z.string().min(1).default('accordia-app'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  TRUST_PROXY: z.enum(['false', 'loopback']).default('false'),
  UPLOAD_DIR: z.string().min(1).default('./var/private-uploads'),
  API_DOCS_ENABLED: z.enum(['true', 'false']).default('false'),
  CORS_ORIGINS: z.string().default(''),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Konfigurasi environment tidak valid', parsed.error.flatten().fieldErrors);
  throw new Error('Konfigurasi environment tidak valid');
}

export const env = {
  ...parsed.data,
  API_DOCS_ENABLED: parsed.data.API_DOCS_ENABLED === 'true',
  TRUST_PROXY: parsed.data.TRUST_PROXY === 'false' ? false : parsed.data.TRUST_PROXY,
  CORS_ORIGINS: parsed.data.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};
