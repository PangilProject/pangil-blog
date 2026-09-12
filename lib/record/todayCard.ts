import type { RecordType } from "@/lib/record/callNumber";
import { isSunday } from "@/lib/record/kst";

/**
 * A-01 오늘의 작성 카드 상태 기계 (02 §3.1).
 *
 * 이 카드가 대시보드의 존재 이유다 — "오늘 쓸 글로 1탭 진입". 그래서 상태 판정을 화면에서
 * 떼어내 여기서 테스트로 고정한다.
 *
 *   ① draft-ready  크롤러가 채워둔 초안이 있고 아직 손대지 않았다 → "이어서 쓰기"
 *   ② writing      쓰던 초안이 있다                              → "이어서 쓰기"
 *   ③ published    오늘 몫을 발행했다                             → "오늘 완료"
 *   ④ crawl-failed 크롤이 실패했다(QT만)                          → "빈 템플릿으로 시작"
 *   ⑤ empty        아무것도 없다                                  → "쓰러 가기"
 *
 * ①과 ②의 차이는 "사람이 한 번이라도 저장했는가"다. 크롤러가 만든 직후에는 updatedAt이
 * createdAt과 같다 — 사람이 저장하면 그때부터 벌어진다.
 */

export type TodayCardState = "draft-ready" | "writing" | "published" | "crawl-failed" | "empty";

export type TodayPost = {
  id: string;
  status: "DRAFT" | "PUBLISHED" | "PRIVATE";
  title: string;
  createdAt: Date;
  updatedAt: Date;
};

export type TodayCrawl = {
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  /** 이 크롤이 만든 초안 */
  postId: string | null;
};

export type TodayCardInput = {
  post: TodayPost | null;
  /** QT에만 있다 (06 §2 — 크롤러는 QT만 만든다) */
  crawl?: TodayCrawl | null;
};

/** 사람이 저장하면 updatedAt이 createdAt보다 뒤로 간다. 1초 미만 차이는 같은 쓰기로 본다 */
const TOUCHED_THRESHOLD_MS = 1000;

function isUntouched(post: TodayPost): boolean {
  return post.updatedAt.getTime() - post.createdAt.getTime() < TOUCHED_THRESHOLD_MS;
}

export function todayCardState({ post, crawl }: TodayCardInput): TodayCardState {
  if (post) {
    if (post.status === "PUBLISHED") return "published";
    // 크롤러가 만들고 아직 손대지 않은 초안 (02 §3.1 ①)
    if (crawl?.postId === post.id && isUntouched(post)) return "draft-ready";
    return "writing";
  }

  // 초안이 없는데 크롤이 실패했다 = 수동 폴백 안내 (프리모템 #1)
  if (crawl?.status === "FAILED") return "crawl-failed";

  return "empty";
}

/**
 * 요일별 카드 구성 (02 §3.1).
 * 월~토는 QT + 찬양, 일요일은 설교 + 찬양. 기술 글은 카드가 아니라 상시 보조 버튼이다.
 */
export function todayCardTypes(now: Date): RecordType[] {
  return isSunday(now) ? ["SERMON", "PRAISE"] : ["QT", "PRAISE"];
}

export const RECORD_TYPE_LABELS: Record<RecordType, string> = {
  QT: "오늘의 큐티",
  SERMON: "오늘의 설교",
  PRAISE: "오늘의 찬양",
  TECH: "기술 글",
};

/** 에디터 경로 — 카드·초안함·글 관리가 같은 규칙을 쓴다 */
export function editorPath(type: RecordType, id?: string | null): string {
  const base = `/admin/write/${type.toLowerCase()}`;
  return id ? `${base}/${id}` : base;
}
