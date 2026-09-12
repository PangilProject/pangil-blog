import { cn } from "@/lib/utils";

/**
 * 상태 도장 (03 §3) — A-01 "오늘의 작성 카드"의 상태를 기울어진 스탬프로 찍는다.
 *
 * 02 §3.1의 카드 상태 기계 4종에 대응한다: 초안 대기(크롤링 완료) / 새로 시작 /
 * 발행 완료 / 크롤러 실패(수동 폴백). 크롤러 실패는 조용히 넘기지 않고 눈에 걸리게
 * 경고색으로 찍는다(프리모템 #1).

 */

/**
 * 도장의 손맛 — 얇은 테두리, 종이가 비치는 바탕, 타자기체.
 *
 * 자리와 크기는 쓰는 쪽이 정한다. 목록 카드처럼 **찍을 빈 모서리가 없는 곳**에서는 줄 안에
 * 서야 하는데(`PostList`의 새 글 표시), 그렇다고 다른 문법을 하나 더 만들 이유는 없다.
 */
/**
 * 바탕은 **토큰이어야 한다.** 흰색 60%를 박아 두었던 동안 다크에서 어두운 카드 위에 밝은 판이
 * 얹혀, 그 위의 글자가 `크롤러 실패` 1.26:1 · `새 글` 1.57:1이 됐다 — 하필 03 §3이
 * "눈에 걸리게 찍는다(프리모템 #1)"고 적어 둔 그 표시다. 카드색을 반투명으로 쓰면
 * "종이가 비친다"는 뜻은 그대로면서 테마를 따라간다.
 */
export const STAMP_SURFACE = "border-[1.5px] bg-card/60 font-typewriter";

export type StateStampKind = "draft-arrived" | "fresh-start" | "done" | "crawl-failed";

const STAMP: Record<StateStampKind, { label: string; tone: string }> = {
  "draft-arrived": { label: "초안 도착", tone: "border-(--accent) text-(--accent)" },
  "fresh-start": { label: "새로 시작", tone: "border-faint text-faint" },
  done: { label: "완료", tone: "border-ok text-ok" },
  // 테두리는 채움색(`--warn`), 글자는 글자색(`--warn-ink`)이다 — 종이 위의 --warn은 2.24:1이다
  "crawl-failed": { label: "크롤러 실패", tone: "border-warn text-warn-ink" },
};

export function StateStamp({ kind, className }: { kind: StateStampKind; className?: string }) {
  const { label, tone } = STAMP[kind];

  return (
    <span
      className={cn(
        "absolute top-[15px] right-[15px] rotate-3 px-[9px] py-[5px] text-[10.5px]",
        STAMP_SURFACE,
        tone,
        className,
      )}
    >
      {label}
    </span>
  );
}
