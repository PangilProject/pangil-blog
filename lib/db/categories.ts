import "server-only";

import { prisma } from "@/lib/db/prisma";
import type { CategoryInput } from "@/lib/record/category";

/**
 * 카테고리 조회·관리 (02 §4 · A-08 · 05 §1.4). TECH만 쓰는 단일 선택 분류다.
 *
 * 에디터에서는 만들지 않는다 — 쓰는 중에 분류를 늘리면 dev 목록의 facet이 매번 바뀐다.
 * 만들고 고치는 자리는 설정(A-08) 한 곳이다.
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
  /** 이 분류에 든 글 수. 목록에는 적지 않고, 지울 때 "몇 편이 옮겨지는지"를 묻는 데 쓴다 */
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
 * 순서를 통째로 다시 매긴다. `ids`는 화면에 놓인 순서 그대로다.
 *
 * 전에는 이웃과 sortOrder를 맞바꾸는 한 칸 이동이었는데, 끌어서 놓으면 여러 칸을 한 번에
 * 건너뛴다 — 그 사이의 분류가 전부 한 칸씩 밀린다. 그래서 전체를 10 간격으로 다시 적는다.
 *
 * 한 트랜잭션이다. 중간에 끊기면 두 분류가 같은 자리를 갖고, 그러면 목록 순서가 이름순으로
 * 떨어져 사람이 정한 순서가 사라진다.
 *
 * `ids`가 지금 분류 전부와 정확히 같지 않으면 아무것도 바꾸지 않고 false다 — 다른 탭에서
 * 분류를 만들거나 지운 뒤의 낡은 목록으로 순서를 매기면 빠진 분류가 엉뚱한 자리에 남는다.
 */
export async function reorderCategoryRecords(ids: string[]): Promise<boolean> {
  const current = await prisma.category.findMany({ select: { id: true } });
  const known = new Set(current.map((row) => row.id));
  if (ids.length !== known.size || new Set(ids).size !== ids.length) return false;
  if (!ids.every((id) => known.has(id))) return false;

  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.category.update({ where: { id }, data: { sortOrder: (index + 1) * 10 } }),
    ),
  );

  return true;
}

/**
 * 분류를 지운다. 딸린 글은 `moveTo`로 옮기고, null이면 분류 없음(미분류)으로 둔다.
 *
 * **옮기기와 지우기는 한 트랜잭션이다.** 스키마는 여전히 `onDelete: Restrict`라 글이 남아
 * 있으면 삭제가 거절된다 — 그래서 옮기기가 절반만 되면 지우기도 안 되고, 글이 어느 쪽에도
 * 걸리지 않는 상태는 생기지 않는다. 스키마를 `SetNull`로 바꾸지 않은 이유가 그것이다:
 * 앱이 옮기는 것을 잊으면 DB가 조용히 비우지 않고 시끄럽게 막는다.
 */
export async function deleteCategoryRecord(id: string, moveTo: string | null): Promise<void> {
  await prisma.$transaction([
    prisma.post.updateMany({ where: { categoryId: id }, data: { categoryId: moveTo } }),
    prisma.category.delete({ where: { id } }),
  ]);
}
