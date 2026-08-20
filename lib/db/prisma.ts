import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/prisma/generated/client";

/**
 * 런타임 쿼리는 pooled URL(pgbouncer, 6543)로만 나간다 — 08 §2.
 * 마이그레이션용 DIRECT_URL은 CLI(prisma.config.ts) 전용이며 앱 런타임에서 쓰지 않는다.
 *
 * 경계 규칙(ADR-002): Prisma `Json` 원시 타입을 이 디렉터리 밖으로 노출하지 않는다.
 * content는 lib/content의 Zod 스키마를 통과한 값만 리포지토리가 반환한다.
 */
const createPrismaClient = () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL이 설정되지 않았습니다 (.env.example 참조).");
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
};

// 개발 중 HMR로 커넥션이 누적되지 않게 전역에 한 인스턴스만 둔다.
const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createPrismaClient> };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
