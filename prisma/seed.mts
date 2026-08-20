import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/client.ts";

/**
 * TECH 카테고리 초기값 시드 (02 §4, 결정 로그 #8).
 * 목록 관리는 A-08 설정 화면이 담당하므로, 이 스크립트는 초기 1회 투입용이다.
 *
 * 실행: npx prisma db seed  (DIRECT_URL 이 아니라 DATABASE_URL 로 붙는다 — 평범한 쿼리)
 * 멱등: slug 기준 upsert — 여러 번 실행해도 이름·정렬만 최신화된다.
 */
const CATEGORIES = [
  { name: "회고", slug: "retrospective" },
  { name: "FE", slug: "fe" },
  { name: "BE", slug: "be" },
  { name: "개발", slug: "dev" },
  { name: "정보", slug: "info" },
  { name: "인프라", slug: "infra" },
  { name: "CS", slug: "cs" },
];

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL이 설정되지 않았습니다 (.env.example 참조).");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

try {
  for (const [index, category] of CATEGORIES.entries()) {
    const sortOrder = (index + 1) * 10;
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name, sortOrder },
      create: { ...category, sortOrder },
    });
  }
  console.warn(`categories 시드 완료: ${CATEGORIES.length}건`);
} finally {
  await prisma.$disconnect();
}
