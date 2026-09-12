import { RecordCard } from "@/components/record/RecordCard";
import { StateStamp } from "@/components/record/StateStamp";
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
  // 03 §7.2 — `이어서 작성`은 쓰지 않는다. 오늘 카드의 `이어서 쓰기`가 그 예외로 적혀 있다.
  // 두 상태의 다음 걸음이 같은 일이므로 말도 같다 — 어느 상태인지는 배지가 말한다
  "draft-ready": "이어서 쓰기 →",
  writing: "이어서 쓰기 →",
  published: "고치러 가기 →",
  "crawl-failed": "빈 템플릿으로 시작 →",
  empty: "쓰러 가기 →",
};

/**
 * 카드에 얹는 표시.
 *
 * **모든 상태에 찍지 않는다.** 다 찍으면 대비가 사라져 `완료`가 성취로 안 읽힌다 —
 * 눈에 걸려야 하는 둘만 찍는다: 오늘 몫을 남긴 것과, 크롤러가 실패한 것(프리모템 #1).
 * 초안이 도착한 카드는 종이 테이프로 표시해 오던 그대로 둔다.
 *
 * `done` 도장은 M1부터 있었는데 **디자인 지면에만 있고 실제 화면에서는 한 번도 안 쓰였다.**
 */
/** 도장이 찍히는 상태. 그 카드에서는 배지가 같은 말을 되풀이하지 않는다 */
function isStamped(state: TodayCardState): boolean {
  return state === "published" || state === "crawl-failed";
}

function Overlay({ state }: { state: TodayCardState }) {
  if (state === "draft-ready") return <Tape />;
  if (state === "published") return <StateStamp kind="done" />;
  if (state === "crawl-failed") return <StateStamp kind="crawl-failed" />;
  return null;
}

export function TodayCard({ type, state, post, subtitle, savedAgo, rotate = 0 }: TodayCardProps) {
  const isEmpty = state === "empty" || state === "crawl-failed";

  return (
    <RecordCard
      variant="today"
      state={isEmpty ? "empty" : "default"}
      rotate={rotate}
      href={editorPath(type, post?.id)}
      aside={savedAgo ?? undefined}
      /*
       * **도장이 말한 것을 배지가 또 말하지 않는다.** `완료` 카드에는 `완료`가 두 번,
       * 실패 카드에는 `가져오지 못함`이 두 번 찍혀 있었다. 한 화면에 같은 말이 두 벌이면
       * 둘 다 덜 읽힌다 — 도장 쪽이 더 크고 눈에 걸리므로 그쪽에 맡긴다.
       */
      meta={
        isStamped(state)
          ? RECORD_TYPE_LABELS[type]
          : `${RECORD_TYPE_LABELS[type]} · ${BADGE_BY_STATE[state]}`
      }
      title={
        post?.title?.trim() ? post.title : <span className="text-ink-soft">아직 빈 카드예요</span>
      }
      subtitle={subtitle ?? HINT_BY_STATE[state]}
      overlay={<Overlay state={state} />}
    >
      <p className="pt-3 font-typewriter text-[11px] text-(--accent)">{ACTION_BY_STATE[state]}</p>
    </RecordCard>
  );
}
