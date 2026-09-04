import "server-only";

import { prisma } from "@/lib/db/prisma";
import type { CategoryInput } from "@/lib/record/category";

/**
 * 카테고리 조회·관리 (02 §4 · A-08 · 05 §1.4). TECH만 쓰는 단일 선택 분류다.
 *
 * 에디터에서는 만들지 않는다 — 쓰는 중에 분류를 늘리면 dev 목록의 facet이 매번 바뀐다.
 * 만들고 고치는 자리는 블로그 관리(A-08) 한 곳이다.
 *
 * faith의 큐티·설교·찬양은 여기 없다. 그건 분류가 아니라 **글의 종류**이고(lib/record/axis),
 * 타입마다 에디터·저장 계약·청구기호 시퀀스가 갈리므로 데이터로 늘릴 수 없다.
 */
export type CategoryOption = { id: string; name: string; slug: string };

export async function listCategories(): Promise<CategoryOption[]> {
  return prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true },
  });
}

export type AdminCategory = CategoryOption & {
  sortOrder: number;
  /** 이 분류에 든 글 수. 0이 아니면 지울 수 없다(스키마의 onDelete: Restrict) */
  postCount: number;
};

/** A-08 목록 — 화면 순서대로, 글 수와 함께 */
export async function listCategoriesForAdmin(): Promise<AdminCategory[]> {
  const rows = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      sortOrder: true,
      _count: { select: { posts: true } },
    },
  });

  return rows.map(({ _count, ...row }) => ({ ...row, postCount: _count.posts }));
}

/**
 * 새 분류. 순서는 맨 뒤다 — 만든 사람이 자리를 정하는 것이 기본값보다 낫다.
 *
 * 간격을 10으로 두는 이유는 시드와 같다: 사이에 끼워 넣을 자리를 남긴다.
 */
export async function createCategoryRecord({ name, slug }: CategoryInput): Promise<void> {
  const last = await prisma.category.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await prisma.category.create({
    data: { name, slug, sortOrder: (last?.sortOrder ?? 0) + 10 },
  });
}

/** 이름만 바꾼다. slug는 공개 주소라 만든 뒤에는 바꾸지 않는다(lib/record/category) */
export async function renameCategoryRecord(id: string, name: string): Promise<void> {
  await prisma.category.update({ where: { id }, data: { name } });
}

/**
 * 위·아래로 한 칸. 이웃과 sortOrder를 맞바꾼다.
 *
 * 한 트랜잭션에 묶는 이유는 중간에 끊기면 두 분류가 같은 자리를 갖기 때문이다 —
 * 그러면 목록 순서가 이름순으로 떨어져 사람이 정한 순서가 사라진다.
 */
export async function moveCategoryRecord(id: string, direction: "up" | "down"): Promise<boolean> {
  const target = await prisma.category.findUnique({
    where: { id },
    select: { id: true, sortOrder: true },
  });
  if (!target) return false;

  const neighbor = await prisma.category.findFirst({
    where:
      direction === "up"
        ? { sortOrder: { lt: target.sortOrder } }
        : { sortOrder: { gt: target.sortOrder } },
    orderBy: { sortOrder: direction === "up" ? "desc" : "asc" },
    select: { id: true, sortOrder: true },
  });
  // 끝에서 더 갈 곳이 없다. 실패가 아니라 아무 일도 없는 것이다
  if (!neighbor) return false;

  await prisma.$transaction([
    prisma.category.update({ where: { id: target.id }, data: { sortOrder: neighbor.sortOrder } }),
    prisma.category.update({ where: { id: neighbor.id }, data: { sortOrder: target.sortOrder } }),
  ]);

  return true;
}

export async function deleteCategoryRecord(id: string): Promise<void> {
  await prisma.category.delete({ where: { id } });
}
