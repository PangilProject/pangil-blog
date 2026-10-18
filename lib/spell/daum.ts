import "server-only";

import { spellCheckByDAUM } from "hanspell";
import { z } from "zod";

import type { SpellTypo } from "@/lib/spell/locate";

/**
 * 다음 맞춤법 검사기 (hanspell).
 *
 * **공식 API가 아니다.** dic.daum.net의 검사 페이지에 글을 보내고 돌아온 HTML을 hanspell이
 * 읽는다. 다음이 페이지를 바꾸는 날 이 함수는 실패한다 — 그래서 호출하는 쪽은 실패를
 * "밑줄 없음"으로 받고 넘어가야 한다. 저장·편집에 닿는 길은 없다.
 *
 * 네이버가 아니라 다음인 이유: 오류 유형·설명·앞뒤 문맥을 함께 준다. 문맥이 있어야 같은
 * 말이 두 번 나올 때 자리를 가를 수 있다(lib/spell/locate). 실측 334ms · 네이버 736ms.
 */

/** 한 요청이 이보다 오래 걸리면 끊는다. 검사 중에도 쓰기는 계속되지만, 기다리는 사람이 있다 */
const TIMEOUT_MS = 8000;

/**
 * hanspell의 결과 모양. 남의 HTML을 긁은 값이라 타입 선언을 믿지 않고 경계에서 좁힌다 —
 * 모양이 어긋난 항목은 버리고 나머지는 쓴다.
 */
const daumTypoSchema = z.object({
  type: z.string(),
  token: z.string(),
  suggestions: z.array(z.string()),
  context: z.string(),
  info: z.string().optional(),
});

export function toSpellTypo(raw: unknown): SpellTypo | null {
  const parsed = daumTypoSchema.safeParse(raw);
  if (!parsed.success) return null;

  const { type, token, suggestions, context, info } = parsed.data;
  const suggestion = suggestions[0];
  // 제안이 없거나 원문과 같으면 고칠 것이 없다
  if (!suggestion || suggestion === token) return null;

  return { type, token, suggestion, context, info: info?.trim() || null };
}

/** 한 덩어리(1000자 안팎)를 검사한다. 일부라도 실패하면 전체를 실패로 본다 — 반쪽 결과는 "다 맞다"로 읽힌다 */
export function checkWithDaum(text: string): Promise<SpellTypo[]> {
  return new Promise((resolve, reject) => {
    const typos: SpellTypo[] = [];
    let failure: unknown = null;

    spellCheckByDAUM(
      text,
      TIMEOUT_MS,
      (found) => {
        for (const raw of found) {
          const typo = toSpellTypo(raw);
          if (typo) typos.push(typo);
        }
      },
      () => (failure ? reject(failure) : resolve(typos)),
      (error) => {
        failure ??= error ?? new Error("spell check failed");
      },
    );
  });
}
