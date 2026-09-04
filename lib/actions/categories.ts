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

export const deleteCategory = withAdmin(
  async (_user, id: string, slug: string): Promise<CategoryActionResult> => {
    try {
      await deleteCategoryRecord(id);
    } catch (cause) {
      // 글이 딸린 분류는 스키마가 막는다(onDelete: Restrict). 그 사실을 화면 말로 옮긴다 —
      // 지워버리면 그 글들이 분류 없는 상태로 남고, 그건 조용한 데이터 손실이다
      const code = (cause as { code?: string } | null)?.code;
      if (code === "P2003" || code === "P2014") {
        return { ok: false, reason: "이 분류에 글이 있어 삭제할 수 없어요" };
      }
      throw cause;
    }

    revalidateDev(slug);
    return { ok: true };
  },
);
