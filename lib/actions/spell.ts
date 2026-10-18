"use server";

import { z } from "zod";

import { withAdmin } from "@/lib/actions/withAdmin";
import { checkWithDaum, SpellCheckerBrokenError } from "@/lib/spell/daum";
import { checkSegments, type LocatedTypo, SpellDeadlineError } from "@/lib/spell/locate";

/**
 * 맞춤법 검사 액션.
 *
 * 상태를 바꾸지 않지만 withAdmin을 통과한다 — 이 액션은 남의 서비스에 글을 보내는 통로라,
 * 열어 두면 아무나 우리 서버를 거쳐 다음에 요청을 쏟을 수 있다.
 *
 * 받는 것은 **글자열 배열뿐**이다. 에디터 위치(ProseMirror pos)는 클라이언트가 들고 있고,
 * 여기서는 "몇 번째 글자열의 몇째 글자"로만 답한다.
 */

/**
 * 설교 한 편이 5천 자 안팎이다. 한 화면 전체로 넉넉히 네 배를 잡는다. 4만 자이던 때는
 * 마감 안에 다 볼 수 없는 양까지 받아 놓고 시간 초과로 실패했다
 */
const MAX_TOTAL_CHARS = 20_000;
const MAX_SEGMENTS = 2_000;

/**
 * 전체 검사의 마감. 서버 함수가 중간에 잘리면 이유 없이 실패하고 로그도 남지 않는다 —
 * 그보다 먼저 끝나야 한다. maxDuration을 따로 주지 않았으므로 가장 짧은 기본값(10초)을
 * 기준으로 잡는다. 덩어리 셋을 동시에 보내면 2만 자가 4초 안팎이다
 */
const DEADLINE_MS = 9_000;

const inputSchema = z.array(z.string()).max(MAX_SEGMENTS);

export type SpellCheckResult =
  | { ok: true; typos: LocatedTypo[] }
  | { ok: false; reason: "too-long" | "timeout" | "failed" };

export const checkSpelling = withAdmin(
  async (_user, segments: string[]): Promise<SpellCheckResult> => {
    const parsed = inputSchema.safeParse(segments);
    if (!parsed.success) return { ok: false, reason: "too-long" };

    const total = parsed.data.reduce((sum, text) => sum + text.length, 0);
    if (total > MAX_TOTAL_CHARS) return { ok: false, reason: "too-long" };

    try {
      const typos = await checkSegments(parsed.data, checkWithDaum, { deadlineMs: DEADLINE_MS });
      return { ok: true, typos };
    } catch (error) {
      if (error instanceof SpellDeadlineError) return { ok: false, reason: "timeout" };

      console.error("[spell] 맞춤법 검사 실패:", error);
      // 저절로 낫지 않는 고장만 거슬림 목록에 적는다. 다시 누르면 되는 일은 적지 않는다
      //
      // 알림 모듈은 이때만 불러온다. 맨 위에서 import하면 이 액션을 쓰는 에디터(클라이언트
      // 컴포넌트)의 모듈 그래프에 Prisma가 딸려 와 에디터 테스트가 통째로 죽는다(RichTextField 주석)
      if (error instanceof SpellCheckerBrokenError) {
        const { noteSpellCheckerBroken } = await import("@/lib/notify/spellChecker");
        await noteSpellCheckerBroken(error.message);
      }
      return { ok: false, reason: "failed" };
    }
  },
);
