import type { RecordType } from "@/lib/record/callNumber";
import { formatKstDay } from "@/lib/record/kst";
import { RECORD_TYPE_LABELS, type TodayPost } from "@/lib/record/todayCard";

/**
 * 미작성일 리마인드 (06 §8 "저녁까지 오늘 글 없으면 알림" · 미결 #6 해소).
 *
 * 기준은 **발행**이다. 크롤러가 매일 QT 초안을 만들어두므로 "초안 있음"을 완료로 보면
 * 알림이 영영 오지 않는다. 하루의 완결은 발행이고, 이 알림의 목적은 스트릭 유지다.
 *
 * 요일별 대상은 대시보드 카드와 같은 규칙을 쓴다(02 §3.1) — 두 곳이 다른 날을 세면
 * 알림과 화면이 서로 다른 말을 한다.
 *
 * 다 발행한 날은 아무 말도 하지 않는다. 잘한 날 오는 알림은 소음이다.
 */

export type ReminderInput = {
  now: Date;
  types: RecordType[];
  posts: Map<RecordType, TodayPost>;
};

export function reminderMessage({ now, types, posts }: ReminderInput): string | null {
  const pending = types.filter((type) => posts.get(type)?.status !== "PUBLISHED");
  if (pending.length === 0) return null;

  const parts = pending.map((type) => {
    const post = posts.get(type);
    const label = RECORD_TYPE_LABELS[type];
    if (!post) return `${label} 없음`;
    return post.status === "DRAFT" ? `${label} 초안` : `${label} ${post.status}`;
  });

  return `🟠 오늘 기록이 남지 않았습니다 · ${formatKstDay(now)} · ${parts.join(" · ")}`;
}
