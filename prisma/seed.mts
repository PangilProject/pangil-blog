import { PrismaPg } from "@prisma/adapter-pg";

import { CATEGORIES, seedCategories } from "./categories.mts";
import { PrismaClient } from "./generated/client.ts";

/**
 * TECH 카테고리 시드 (02 §4).
 *
 * 실행: npx prisma db seed (DIRECT_URL이 아니라 DATABASE_URL로 붙는다 — 평범한 쿼리)
 * 목록·멱등 규칙은 categories.mts에 있다.
 */
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL이 설정되지 않았습니다 (.env.example 참조).");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

try {
  await seedCategories(prisma);
  console.warn(`categories 시드 완료: ${CATEGORIES.length}건`);
} finally {
  await prisma.$disconnect();
}
