import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * 칸막이 탭 (03 §3) — 서랍 칸막이 형태의 필터 탭. 활성 탭은 액센트 상단 인셋을 갖는다.
 *
 * F-01/D-01의 타입·카테고리 필터가 이걸 쓴다. 같은 시각 언어를 F-03의 질문 그룹 헤더
 * (GroupTab)가 다시 쓰기 때문에, 목록과 상세가 하나의 문법으로 읽힌다.
 *
 * 필터는 URL로 공유 가능한 뷰(02 §2.3 F-02)이므로 탭은 버튼이 아니라 링크다 —
 * 공개 페이지에 클라이언트 JS를 늘리지 않는다(04 §3.6).
 */

export type DividerTabItem = {
  label: string;
  href: string;
  active?: boolean;
  /**
   * 누르면 이동 대신 이 일을 한다 (A-04~06 서식 탭).
   *
   * **공개 지면은 이 값을 넘기지 않는다** — 거기서 탭은 URL로 공유되는 뷰이고 링크여야 한다
   * (04 §3.6, 공개 페이지에 JS를 늘리지 않는다). 관리 화면에서 이동 전에 정리할 것이 있을
   * 때만 쓴다: 서식 전환은 빈 초안을 지우고 옮기므로 링크로 두면 그 정리가 빠진다.
   */
  onSelect?: () => void;
};

/** 탭 한 칸의 옷. 링크·버튼·메뉴 트리거가 같이 입는다 — 두 벌로 두면 그중 하나만 낡는다 */
export function dividerTabClassName(active: boolean | undefined): string {
  return cn(
    "relative top-px inline-block rounded-t-[5px] border border-edge border-b-0",
    "px-[15px] pt-2 pb-2.5 font-typewriter text-xs transition-colors duration-200",
    active
      ? "bg-card font-bold text-ink shadow-[inset_0_2px_0_var(--accent)]"
      : "bg-surface-tab text-ink-soft hover:text-ink",
  );
}

export type DividerTabsProps = {
  items: DividerTabItem[];
  /** 줄 끝에 붙는 칸 — 하위 분류를 접어 둔 메뉴 탭(글 관리의 `기술 ▾`)이 여기 온다 */
  trailing?: ReactNode;
  /** 스크린리더용 이름 (예: "묵상 타입 필터") */
  label: string;
  className?: string;
};

export function DividerTabs({ items, label, className, trailing }: DividerTabsProps) {
  return (
    <nav aria-label={label} className={cn("border-edge border-b", className)}>
      <ul className="flex flex-wrap gap-1.5">
        {items.map((item) => {
          const className = dividerTabClassName(item.active);

          return (
            <li key={item.label}>
              {item.onSelect ? (
                <button
                  type="button"
                  onClick={item.onSelect}
                  aria-current={item.active ? "page" : undefined}
                  className={className}
                >
                  {item.label}
                </button>
              ) : (
                <Link
                  href={item.href}
                  aria-current={item.active ? "page" : undefined}
                  className={className}
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
        {trailing && <li>{trailing}</li>}
      </ul>
    </nav>
  );
}
