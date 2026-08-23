import "server-only";

import { prisma } from "@/lib/db/prisma";

/**
 * 카테고리 조회 (02 §4 · 05 §1.4). TECH만 쓰는 단일 선택 분류다.
 *
 * 카테고리는 시드로 관리한다(05 §1.4 · prisma/seed) — 에디터에서 만들지 않는다.
 * 분류를 즉석에서 늘리면 dev 목록의 facet이 매번 바뀐다.
 */
export type CategoryOption = { id: string; name: string; slug: string };

export async function listCategories(): Promise<CategoryOption[]> {
  return prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true },
  });
}
