import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * 찬양 섹션 블록 (02 §5.4 · 03 §6.2) — 라벨 + 가사.
 *
 * 가사 칸에 서식이 없는 것은 의도다. 타이핑이 곧 묵상이므로(01 §1) 서식 고민을 끼워넣지
 * 않는다. Verse 넘버링은 렌더 시 파생 계산이고 저장하지 않는다(04 §2.5).
 *
 * M1은 시각까지다. dnd-kit 정렬·인라인 편집은 M2에서 붙인다.
 */

export const SECTION_LABELS = [
  "Intro",
  "Verse",
  "Pre-Chorus",
  "Chorus",
  "Bridge",
  "Interlude",
  "Outro",
] as const;

export type SectionLabel = (typeof SECTION_LABELS)[number];

export type SectionBlockProps = {
  /** enum 7종 또는 직접 입력한 라벨(02 §5.4 — Tag·Refrain 등 예외 대응) */
  label: SectionLabel | string;
  /** 같은 라벨의 등장 순서. 있으면 "Verse 2"처럼 적는다 */
  ordinal?: number;
  /** 빈 섹션 허용 — "16 Bar" 같은 연주 메모만 있는 섹션이 실제로 있다 */
  lyrics?: string;
  /** 정렬·삭제 등 블록 조작 (M2) */
  controls?: ReactNode;
  className?: string;
};

export function SectionBlock({ label, ordinal, lyrics, controls, className }: SectionBlockProps) {
  return (
    <section className={cn("group border border-edge bg-[#fffefa]", className)}>
      <header className="flex items-center gap-2 border-b border-dashed border-[#ede5d3] px-3 py-[9px]">
        <span className="border border-edge bg-paper px-[7px] py-1 font-typewriter text-[11.5px]">
          {label}
        </span>
        {ordinal !== undefined && (
          <span className="font-typewriter text-[10.5px] text-faint">{ordinal}</span>
        )}
        {controls && (
          <span className="ml-auto flex gap-1 opacity-35 transition-opacity duration-200 group-hover:opacity-100">
            {controls}
          </span>
        )}
      </header>
      <p
        className={cn(
          "min-h-[52px] whitespace-pre-line px-[13px] py-[11px] font-serif text-sm leading-body",
          lyrics ? "text-ink" : "text-[#c4bcaa]",
        )}
      >
        {lyrics || "가사를 적어보세요"}
      </p>
    </section>
  );
}
