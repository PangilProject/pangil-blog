import type { PrismaClient } from "./generated/client.ts";

/**
 * TECH 카테고리 초기값 (02 §4, 결정 로그 #8).
 *
 * 목록은 여기 한 곳에만 있다. 시드와 배포 부트스트랩이 같은 목록을 쓴다 — 두 곳에 적으면
 * prod와 dev의 분류가 조용히 갈린다.
 */
export const CATEGORIES = [
  { name: "회고", slug: "retrospective" },
  { name: "FE", slug: "fe" },
  { name: "BE", slug: "be" },
  { name: "개발", slug: "dev" },
  { name: "정보", slug: "info" },
  { name: "인프라", slug: "infra" },
  { name: "CS", slug: "cs" },
];

export type SeedCategoriesResult = { upserted: number; skipped: boolean };

/**
 * slug 기준 upsert. 여러 번 실행해도 이름·정렬만 최신화된다.
 *
 * `onlyIfEmpty`는 배포 부트스트랩용이다. 배포마다 upsert하면 나중에 A-08 설정 화면에서
 * 바꾼 이름이 다음 배포에 되돌아간다 — 비어 있을 때만 넣는다.
 */
export async function seedCategories(
  prisma: PrismaClient,
  { onlyIfEmpty = false } = {},
): Promise<SeedCategoriesResult> {
  if (onlyIfEmpty && (await prisma.category.count()) > 0) {
    return { upserted: 0, skipped: true };
  }

  for (const [index, category] of CATEGORIES.entries()) {
    const sortOrder = (index + 1) * 10;
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name, sortOrder },
      create: { ...category, sortOrder },
    });
  }

  return { upserted: CATEGORIES.length, skipped: false };
}
