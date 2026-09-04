import { RecordCard } from "@/components/record/RecordCard";
import { Tape } from "@/components/record/Tape";
import type { RecordType } from "@/lib/record/callNumber";
import { editorPath, RECORD_TYPE_LABELS, type TodayCardState } from "@/lib/record/todayCard";

/**
 * A-01 오늘의 작성 카드 (02 §3.1 · 03 §6.2).
 *
 * 상태를 가진 버튼이다. 상태 판정은 lib/record/todayCard가 하고, 여기서는 그 상태에 맞는
 * 문구와 도착지만 정한다 — 카드가 곧 1탭 진입점이므로 어디로 가는지가 흐트러지면 안 된다.
 *
 * 목록 카드와 같은 RecordCard를 쓴다. 관리 화면과 공개 지면이 같은 카드 조판을 공유하는 것이
 * 이 시스템의 축이다(04 §3.5).
 */

export type TodayCardProps = {
  type: RecordType;
  state: TodayCardState;
  post: { id: string; title: string } | null;
  /** "말씀 범위" 같은 한 줄 — 있으면 카드 부제로 쓴다 */
  subtitle?: string | null;
  /** 마지막 저장 시각 표기 */
  savedAgo?: string | null;
  rotate?: number;
};

const HINT_BY_STATE: Record<TodayCardState, string> = {
  "draft-ready": "말씀·질문이 채워져 있어요",
  writing: "쓰던 자리에서 이어져요",
  published: "오늘 몫을 남겼어요",
  "crawl-failed": "직접 적어도 오늘 기록은 남아요",
  empty: "여기서 시작하면 돼요",
};

const BADGE_BY_STATE: Record<TodayCardState, string> = {
  "draft-ready": "초안 도착",
  writing: "작성 중",
  published: "완료",
  "crawl-failed": "가져오지 못함",
  empty: "새로 시작",
};

const ACTION_BY_STATE: Record<TodayCardState, string> = {
  "draft-ready": "이어서 쓰기 →",
  writing: "이어서 작성 →",
  published: "고치러 가기 →",
  "crawl-failed": "빈 템플릿으로 시작 →",
  empty: "쓰러 가기 →",
};

export function TodayCard({ type, state, post, subtitle, savedAgo, rotate = 0 }: TodayCardProps) {
  const isEmpty = state === "empty" || state === "crawl-failed";

  return (
    <RecordCard
      variant="today"
      state={isEmpty ? "empty" : "default"}
      rotate={rotate}
      href={editorPath(type, post?.id)}
      aside={savedAgo ?? undefined}
      meta={`${RECORD_TYPE_LABELS[type]} · ${BADGE_BY_STATE[state]}`}
      title={
        post?.title?.trim() ? post.title : <span className="text-ink-soft">아직 빈 카드예요</span>
      }
      subtitle={subtitle ?? HINT_BY_STATE[state]}
      overlay={state === "draft-ready" ? <Tape /> : undefined}
    >
      <p className="pt-3 font-typewriter text-[11px] text-(--accent)">{ACTION_BY_STATE[state]}</p>
    </RecordCard>
  );
}
