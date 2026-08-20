import "dotenv/config";

import { defineConfig } from "prisma/config";

/**
 * 이중 URL (08 §2):
 * - DATABASE_URL  = pooled(pgbouncer, 6543) → 런타임 쿼리. lib/db/prisma.ts에서 사용
 * - DIRECT_URL    = direct(5432)            → prisma migrate/introspect 전용. 여기서 사용
 *
 * Prisma 7부터 연결 URL이 schema.prisma의 datasource에서 이 파일로 이전됐다.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node prisma/seed.ts",
  },
  datasource: {
    url: process.env.DIRECT_URL,
  },
});
