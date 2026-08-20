import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * 질문 그룹 헤더 (03 §3·§5.2) — QT 상세의 "내용관찰 / 연구와 묵상 / 느낀 점 / 결단과 적용".
 *
 * 목록 필터(DividerTabs)와 같은 칸막이 탭 형태를 쓴다. 필터도 그룹도 "서랍의 칸"이라는
 * 같은 은유이므로 시각 언어를 공유한다.
 */
export function GroupTab({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "inline-block rounded-t border border-edge bg-surface-tab px-[13px] pt-1.5 pb-[7px]",
        "font-typewriter text-[11px] text-ink shadow-[inset_0_2px_0_var(--accent)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
