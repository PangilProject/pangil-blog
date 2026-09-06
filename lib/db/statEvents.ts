import "server-only";

import { prisma } from "@/lib/db/prisma";
import type { StatPayload } from "@/lib/stats/statSchema";
import { Device, Site, StatEventType } from "@/prisma/generated/enums";

/**
 * stat_events 리포지토리 (05 §1.4 · §4).
 *
 * **append만 한다.** 이 테이블은 로그이고, 여기에 조회·집계 함수를 두지 않는다 — 대시보드는
 * Backlog이고(00 §5.2), 수집이 먼저다. 인덱스도 `(site, occurredAt)` 하나뿐이라(05 §4.3)
 * 지금 집계를 얹으면 인덱스를 먼저 정해야 한다.
 *
 * `postId`는 FK가 아니다 — 글을 지웠다고 과거 통계가 사라지면 그건 기록이 아니다(05 §1.4).
 */

export type StatEventInput = {
  payload: StatPayload;
  visitorHash: string;
  device: "MOBILE" | "DESKTOP";
  /** 운영자 본인의 방문인가 (05 §4.1). 버리지 않고 표시해 둔다 — 읽을 때 고른다 */
  isOwner: boolean;
};

export async function recordStatEvent({
  payload,
  visitorHash,
  device,
  isOwner,
}: StatEventInput): Promise<void> {
  await prisma.statEvent.create({
    data: {
      site: Site[payload.site.toUpperCase() as keyof typeof Site],
      eventType: StatEventType[payload.eventType],
      path: payload.path,
      postId: payload.postId ?? null,
      referrer: payload.referrer ?? null,
      utmSource: payload.utmSource ?? null,
      visitorHash,
      device: Device[device],
      durationMs: payload.durationMs ?? null,
      isOwner,
    },
  });
}
