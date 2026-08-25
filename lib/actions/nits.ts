"use server";

import { revalidatePath } from "next/cache";

import { withAdmin } from "@/lib/actions/withAdmin";
import { addNit as insertNit, resolveNit as markResolved } from "@/lib/db/nits";

/**
 * 거슬림 목록 액션 (03 §3).
 *
 * **클라이언트 컴포넌트를 만들지 않는다.** 평범한 `<form action={...}>`이면 JS 없이 동작하고,
 * 관리 화면에 아일랜드를 하나 더 늘리지 않는다(04 §3.6의 취지는 공개 지면이 우선이지만
 * 관리 화면도 무겁게 할 이유가 없다).
 *
 * 무효화는 `revalidatePath("/admin")` 하나다. 이건 캐시되는 공개 지면이 아니라 관리 화면이므로
 * 태그 체계(04 §1.2)를 쓸 자리가 아니다.
 */

/** 한 줄 메모다. 길어지면 그건 이슈지 거슬림이 아니다 */
const MAX_LENGTH = 200;

export const addNit = withAdmin(async (_user, formData: FormData) => {
  const body = String(formData.get("body") ?? "")
    .trim()
    .slice(0, MAX_LENGTH);

  // 빈 제출은 조용히 무시한다 — 실수로 엔터를 눌렀을 때 오류 화면이 뜨면 그게 더 거슬린다
  if (body.length === 0) return;

  await insertNit(body);
  revalidatePath("/admin");
});

export const resolveNit = withAdmin(async (_user, formData: FormData) => {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await markResolved(id);
  revalidatePath("/admin");
});
