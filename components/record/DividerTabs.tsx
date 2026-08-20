import Link from "next/link";

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
};

export type DividerTabsProps = {
  items: DividerTabItem[];
  /** 스크린리더용 이름 (예: "묵상 타입 필터") */
  label: string;
  className?: string;
};

export function DividerTabs({ items, label, className }: DividerTabsProps) {
  return (
    <nav aria-label={label} className={cn("border-edge border-b", className)}>
      <ul className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={cn(
                "relative top-px inline-block rounded-t-[5px] border border-edge border-b-0",
                "px-[15px] pt-2 pb-2.5 font-typewriter text-xs transition-colors duration-200",
                item.active
                  ? "bg-card font-bold text-ink shadow-[inset_0_2px_0_var(--accent)]"
                  : "bg-surface-tab text-ink-soft hover:text-ink",
              )}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
