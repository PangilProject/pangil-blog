import "server-only";

import { after } from "next/server";

import { notifySlack } from "@/lib/notify/slack";

/**
 * 렌더링 전 검증이 실패했을 때 알린다 (04 §2.4 · 05 §1.6 — "raw 폴백 + 알림").
 *
 * 한동안 `console.error`로만 끝났다. 규약은 알림까지였고 코드 주석은 "알림은 M4에서 붙는다"였는데
 * M4는 지난 마일스톤이다. 크롤러에 그렇게 강하게 건 "조용히 넘어가지 말 것"이 렌더 경로에만
 * 빠져 있었다.
 *
 * **두 겹으로 빈도를 누른다.** 이 자리는 `use cache` 안이라(ADR-003) 캐시가 비었을 때만 돈다 —
 * 그것만으로도 요청마다 나가지는 않지만, 빌드가 지면을 한꺼번에 그릴 때는 같은 글이 여러 번
 * 걸릴 수 있다. 그래서 **한 인스턴스에서 글 하나당 한 번만** 보낸다. 소음이 되면 사람이 안 읽고,
 * 안 읽는 채널은 없는 것과 같다(`slack.ts`의 소음 관리와 같은 이유).
 *
 * **보내는 일은 응답 뒤로 미룬다**(`after`). 읽는 사람의 지면이 Slack 왕복을 기다릴 이유가 없고,
 * 캐시된 렌더 안에서 부작용을 일으키지도 않는다.
 *
 * 실패해도 조용히 넘어간다 — 알림을 못 보낸 것이 글을 못 보여줄 이유는 아니다.
 */
const reported = new Set<string>();

export function reportBrokenContent(postId: string, issues: string[]): void {
  // 로그는 매번 남긴다. 빈도를 누르는 것은 사람에게 가는 쪽뿐이다
  console.error(`[render] content 스키마 실패 (${postId}): ${issues.join(" / ")}`);

  if (reported.has(postId)) return;
  reported.add(postId);

  // 처음 세 줄이면 어느 필드가 깨졌는지는 충분히 드러난다
  const detail = issues.slice(0, 3).join(" / ");

  try {
    after(() => notifySlack(`🔴 렌더 검증 실패 · 글 ${postId} · ${detail}`));
  } catch {
    // `after`를 쓸 수 없는 자리(요청 밖)면 로그만 남는다
  }
}
