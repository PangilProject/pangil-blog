import "server-only";

import { prisma } from "@/lib/db/prisma";

/**
 * 알림이 못 나간 사실을 **보이는 곳에** 남긴다 (프리모템 #1 · 03 §3).
 *
 * 조용한 채널의 약점은 **웹훅이 죽어도 똑같이 조용하다**는 것이다. 성공 알림은 일부러 껐고
 * (`slack.ts`의 소음 관리), 실패는 `console.error`로만 남았는데 그 로그는 아무도 안 본다
 * (전수조사 PM §3.3). 그래서 정상과 고장이 화면에서 구분되지 않았다.
 *
 * **새 화면을 만들지 않는다.** 거슬림 목록(`Nit`)이 이미 매일 아침 여는 A-01에 떠 있고,
 * 뜻도 맞는다 — 알림이 안 나가는 것은 거슬리는 일이다. 처리하면 그 목록에서 `완료`로 닫는다.
 *
 * **한 번만 적는다.** 웹훅이 죽어 있으면 알림마다 한 줄씩 쌓여 목록이 벽이 된다(그 목록의
 * 상한은 6줄이다). 같은 사유로 이미 열려 있으면 조용히 넘어간다.
 *
 * **여기서도 throw하지 않는다.** DB가 흔들려서 크롤이나 백업이 죽으면 본말이 뒤집힌다 —
 * 알림이 안 나간 것을 못 적은 것이 그 작업을 되돌릴 이유는 아니다.
 */
export async function noteUnreachable(reason: string): Promise<void> {
  const body = `${reason} — 웹훅이 살아 있는지 확인해 주세요`;

  try {
    const already = await prisma.nit.findFirst({
      where: { body, doneAt: null },
      select: { id: true },
    });
    if (already) return;

    await prisma.nit.create({ data: { body } });
  } catch (error) {
    console.error("[slack] 알림 실패를 거슬림 목록에 적지도 못했습니다", error);
  }
}
