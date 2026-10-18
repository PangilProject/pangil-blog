"use server";

import { z } from "zod";

import { withAdmin } from "@/lib/actions/withAdmin";
import { checkWithDaum } from "@/lib/spell/daum";
import { checkSegments, type LocatedTypo } from "@/lib/spell/locate";

/**
 * 맞춤법 검사 액션.
 *
 * 상태를 바꾸지 않지만 withAdmin을 통과한다 — 이 액션은 남의 서비스에 글을 보내는 통로라,
 * 열어 두면 아무나 우리 서버를 거쳐 다음에 요청을 쏟을 수 있다.
 *
 * 받는 것은 **글자열 배열뿐**이다. 에디터 위치(ProseMirror pos)는 클라이언트가 들고 있고,
 * 여기서는 "몇 번째 글자열의 몇째 글자"로만 답한다.
 */

/** 설교 한 편이 5천 자 안팎이다. 넉넉히 잡되, 끝없이 보내지는 못하게 한다 */
const MAX_TOTAL_CHARS = 40_000;
const MAX_SEGMENTS = 2_000;

const inputSchema = z.array(z.string()).max(MAX_SEGMENTS);

export type SpellCheckResult =
  | { ok: true; typos: LocatedTypo[] }
  | { ok: false; reason: "too-long" | "failed" };

export const checkSpelling = withAdmin(
  async (_user, segments: string[]): Promise<SpellCheckResult> => {
    const parsed = inputSchema.safeParse(segments);
    if (!parsed.success) return { ok: false, reason: "too-long" };

    const total = parsed.data.reduce((sum, text) => sum + text.length, 0);
    if (total > MAX_TOTAL_CHARS) return { ok: false, reason: "too-long" };

    try {
      return { ok: true, typos: await checkSegments(parsed.data, checkWithDaum) };
    } catch (error) {
      // 화면에는 "검사하지 못했어요"까지만 간다. 다음이 페이지를 바꿨는지는 로그로 본다
      console.error("[spell] 맞춤법 검사 실패:", error);
      return { ok: false, reason: "failed" };
    }
  },
);
