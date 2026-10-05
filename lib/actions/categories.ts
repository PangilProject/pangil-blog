"use server";

import { updateTag } from "next/cache";

import { withAdmin } from "@/lib/actions/withAdmin";
import {
  createCategoryRecord,
  deleteCategoryRecord,
  moveCategoryRecord,
  renameCategoryRecord,
} from "@/lib/db/categories";
import { validateCategoryInput } from "@/lib/record/category";
import { feedTag, listFacetTag, listTag } from "@/lib/revalidate/tags";

/**
 * 카테고리 관리 (A-08 · 02 §4).
 *
 * TECH 전용 분류다. faith의 큐티·설교·찬양은 여기 없다 — 그건 글의 종류이고 데이터로
 * 늘릴 수 없다(lib/record/axis).
 *
 * **무효화가 이 파일의 절반이다.** 분류 이름은 목록 카드·글 상세·탭·RSS에 함께 박혀 나가므로,
 * 이름 하나를 바꾸면 dev 지면이 통째로 다시 그려져야 한다. 상세 지면도 `list:dev`를 보고
 * 있으므로(04 §1.2) 이 한 태그가 카드와 상세를 함께 만료시킨다.
 */

export type CategoryActionResult =
  | { ok: true }
  | { ok: false; reason: string; field?: "name" | "slug" };

/** dev 지면 전체 + 그 분류의 목록 뷰 + 피드 */
function revalidateDev(slug?: string) {
  updateTag(listTag("dev"));
  updateTag(feedTag("dev"));
  if (slug) updateTag(listFacetTag("dev", slug));
}

/** unique 위반(P2002)만 사람 말로 옮긴다. 나머지는 그대로 올려보낸다 */
function conflictOf(cause: unknown): CategoryActionResult | null {
  const code = (cause as { code?: string } | null)?.code;
  if (code !== "P2002") return null;

  const target = String((cause as { meta?: { target?: unknown } }).meta?.target ?? "");
  return target.includes("slug")
    ? { ok: false, reason: "이미 쓰는 주소예요", field: "slug" }
    : { ok: false, reason: "이미 쓰는 이름이에요", field: "name" };
}

export const createCategory = withAdmin(
  async (_user, input: { name: string; slug: string }): Promise<CategoryActionResult> => {
    const invalid = validateCategoryInput(input);
    if (invalid) return { ok: false, reason: invalid.message, field: invalid.field };

    const name = input.name.trim();
    const slug = input.slug.trim();

    try {
      await createCategoryRecord({ name, slug });
    } catch (cause) {
      const conflict = conflictOf(cause);
      if (conflict) return conflict;
      throw cause;
    }

    revalidateDev(slug);
    return { ok: true };
  },
);

export const renameCategory = withAdmin(
  async (_user, id: string, name: string): Promise<CategoryActionResult> => {
    // slug는 그대로 두므로 주소 규칙은 보지 않는다. 이름만 본다
    const invalid = validateCategoryInput({ name, slug: "placeholder" });
    if (invalid) return { ok: false, reason: invalid.message, field: invalid.field };

    try {
      await renameCategoryRecord(id, name.trim());
    } catch (cause) {
      const conflict = conflictOf(cause);
      if (conflict) return conflict;
      throw cause;
    }

    revalidateDev();
    return { ok: true };
  },
);

export const moveCategory = withAdmin(
  async (_user, id: string, direction: "up" | "down"): Promise<CategoryActionResult> => {
    // 끝에서 더 갈 곳이 없으면 아무 일도 없다. 그건 실패가 아니다
    if (await moveCategoryRecord(id, direction)) revalidateDev();
    return { ok: true };
  },
);

/**
 * 분류 삭제. 딸린 글은 `moveTo`(다른 분류)로 옮기거나, null이면 미분류로 둔다.
 *
 * 글이 있다고 막지 않는다(2026-10-05). 막으면 분류를 정리하려고 글을 한 편씩 열어 바꿔야
 * 했다. 옮길 곳을 고르게 하면 그게 곧 병합이다.
 */
export const deleteCategory = withAdmin(
  async (
    _user,
    id: string,
    slug: string,
    moveTo: { id: string; slug: string } | null,
  ): Promise<CategoryActionResult> => {
    if (moveTo?.id === id) return { ok: false, reason: "지우는 분류로는 옮길 수 없어요" };

    try {
      await deleteCategoryRecord(id, moveTo?.id ?? null);
    } catch (cause) {
      // 옮길 곳이 그사이 지워졌다(FK 위반). 트랜잭션이라 아무것도 바뀌지 않았다
      const code = (cause as { code?: string } | null)?.code;
      if (code === "P2003") return { ok: false, reason: "옮길 분류를 찾지 못했어요" };
      throw cause;
    }

    revalidateDev(slug);
    if (moveTo) updateTag(listFacetTag("dev", moveTo.slug));
    return { ok: true };
  },
);
