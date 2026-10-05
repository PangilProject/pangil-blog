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
    // **풀을 작게 둔다.** `pg.Pool` 기본값은 10인데, 서버리스에서는 그게 인스턴스 하나당
    // 10이다 — 인스턴스가 뜰 때마다 Supavisor에 연결이 그만큼 열리고, Pooler 로그는
    // 연결 하나당 세 줄(authenticated·backend·terminate)을 찍는다. 2026-10-05 측정에서
    // Pooler가 전체 로그의 58%였고, Free 플랜의 로그 한도를 넘긴 것이 그 58%다.
    //
    // 셋인 이유는 **한 요청이 동시에 여는 쿼리 수**가 그 정도이기 때문이다(허브가 사이트
    // 둘을 나란히 센다). 더 줄이면 그 둘이 서로를 기다린다.
    adapter: new PrismaPg({ connectionString, max: 3 }),
  });
};

// 개발 중 HMR로 커넥션이 누적되지 않게 전역에 한 인스턴스만 둔다.
const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createPrismaClient> };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
