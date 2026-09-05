import { isSunday } from "@/lib/record/kst";
import type { TodayCrawl } from "@/lib/record/todayCard";

/**
 * 손으로 크롤을 한 번 더 돌릴 수 있는가 (A-01 · 06 §5).
 *
 * 크롤은 새벽에 Actions가 돈다. 하지만 **안 돌 수 있다** — Actions 스케줄은 레포가 60일
 * 조용하면 꺼지고, 그날 365qt가 늦게 올리면 빈손으로 끝난다(프리모템 #1). 그때 대시보드가
 * 할 수 있는 말이 "아직 오늘 큐티를 못 가져왔어요"뿐이면, 손으로 할 수 있는 일은 레포를
 * 열어 워크플로우를 찾아 누르는 것이다. 그 길을 대시보드로 당긴다.
 *
 * 판정을 화면에서 떼어 여기 두는 이유는 오늘의 카드와 같다 — 조건이 넷이고, 그중 하나는
 * 규약을 일부러 비껴간다.
 *
 *   none   일요일. 크롤이 도는 날이 아니다 → 버튼을 그리지 않는다
 *   ready  아직 흔적이 없다                → 누를 수 있다
 *   retry  돌았지만 실패했다               → 누를 수 있다
 *   done   가져왔거나 큐티 없는 날이었다   → 비활성
 *
 * **실패는 `done`이 아니다.** "한 번 돌았으면 비활성"을 글자대로 따르면 가장 손이 필요한
 * 날에 버튼이 잠긴다 — 실패한 크롤은 아무것도 만들지 않았으므로 그날 큐티는 여전히 없다.
 * 그래서 실패만 다시 열어 둔다. 같은 날짜를 두 번 돌려도 `runDate`가 멱등이라 초안이 둘로
 * 갈라지지 않는다(05 §1.4).
 */
export type CrawlTriggerState = "none" | "ready" | "retry" | "done";

export function crawlTriggerState(now: Date, crawl: TodayCrawl | null): CrawlTriggerState {
  if (isSunday(now)) return "none";
  if (!crawl) return "ready";

  return crawl.status === "FAILED" ? "retry" : "done";
}

/** 버튼 라벨은 명사형이다(03 §7.1). 다시 부르는 것은 처음 부르는 것과 다른 일이라 갈린다 */
export function crawlTriggerLabel(state: CrawlTriggerState): string {
  return state === "retry" ? "다시 가져오기" : "큐티 가져오기";
}
