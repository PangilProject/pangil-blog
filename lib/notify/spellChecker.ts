import "server-only";

import { prisma } from "@/lib/db/prisma";

/**
 * 맞춤법 검사기가 고장 났다는 사실을 **보이는 곳에** 남긴다.
 *
 * 다음 검사기는 공식 API가 아니다(lib/spell/daum). 다음이 페이지를 바꾸거나 Vercel IP를
 * 막는 날, 화면에는 "검사하지 못했어요"만 뜨고 서버 로그는 아무도 안 본다 — `noteUnreachable`이
 * 막으려던 바로 그 상태다. 그래서 같은 자리, 매일 아침 여는 거슬림 목록에 한 줄 적는다.
 *
 * **저절로 낫지 않는 것만** 적는다(`SpellCheckerBrokenError`). 타임아웃·네트워크 끊김은
 * 다시 누르면 되는 일이라 적지 않는다 — 적으면 목록이 소음이 된다.
 *
 * **한 번만 적고, 던지지 않는다.** 이미 열려 있으면 넘어가고, DB가 흔들려도 검사 실패
 * 응답은 그대로 나간다.
 */
const BODY =
  "맞춤법 검사기가 응답하지 않아요 — 다음 맞춤법 검사기 페이지가 바뀌었거나 막혔는지 확인해 주세요";

export async function noteSpellCheckerBroken(detail: string): Promise<void> {
  try {
    const already = await prisma.nit.findFirst({
      where: { body: BODY, doneAt: null },
      select: { id: true },
    });
    if (already) return;

    await prisma.nit.create({ data: { body: BODY } });
    console.error("[spell] 검사기 고장을 거슬림 목록에 적었습니다:", detail);
  } catch (error) {
    console.error("[spell] 검사기 고장을 거슬림 목록에 적지도 못했습니다", error);
  }
}
