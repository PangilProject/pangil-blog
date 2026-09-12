import { cn } from "@/lib/utils";

/**
 * 상태 도장 (03 §3) — A-01 "오늘의 작성 카드"의 상태를 기울어진 스탬프로 찍는다.
 *
 * 02 §3.1의 카드 상태 기계 4종에 대응한다: 초안 대기(크롤링 완료) / 새로 시작 /
 * 발행 완료 / 크롤러 실패(수동 폴백). 크롤러 실패는 조용히 넘기지 않고 눈에 걸리게
 * 경고색으로 찍는다(프리모템 #1).

 */

export type StateStampKind = "draft-arrived" | "fresh-start" | "done" | "crawl-failed";

const STAMP: Record<StateStampKind, { label: string; tone: string }> = {
  "draft-arrived": { label: "초안 도착", tone: "border-(--accent) text-(--accent)" },
  "fresh-start": { label: "새로 시작", tone: "border-faint text-faint" },
  done: { label: "완료", tone: "border-ok text-ok" },
  "crawl-failed": { label: "크롤러 실패", tone: "border-warn text-warn" },
};

export function StateStamp({ kind, className }: { kind: StateStampKind; className?: string }) {
  const { label, tone } = STAMP[kind];

  return (
    <span
      className={cn(
        "absolute top-[15px] right-[15px] rotate-3 border-[1.5px] bg-[rgb(255_255_255_/_60%)]",
        "px-[9px] py-[5px] font-typewriter text-[10.5px]",
        tone,
        className,
      )}
    >
      {label}
    </span>
  );
}
