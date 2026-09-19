import type { ReactNode } from "react";

import type { PRAISE_SECTION_LABELS } from "@/lib/content/schema";
import { cn } from "@/lib/utils";

/**
 * 찬양 섹션 블록 (02 §5.4 · 03 §6.2) — 라벨 + 가사.
 *
 * 가사 칸에 서식이 없는 것은 의도다. 타이핑이 곧 묵상이므로(01 §1) 서식 고민을 끼워넣지
 * 않는다. Verse 넘버링은 렌더 시 파생 계산이고 저장하지 않는다(04 §2.5).
 *
 * M1은 시각까지다. dnd-kit 정렬·인라인 편집은 M2에서 붙인다.
 */

/**
 * 라벨 목록은 **스키마가 가진다**(`lib/content`). 여기 한 벌 더 두었던 동안 둘을 묶는 장치가
 * "지금 값이 같다"뿐이었다 — 라벨이 여덟 종이 되면 한쪽만 고쳐지고, 그때 에디터는 새 라벨을
 * 그릴 수 있는데 저장이 거절된다(AGENTS.md 경계 규칙 · 전수조사 개발 1-6).
 */
export type SectionLabel = (typeof PRAISE_SECTION_LABELS)[number];

export type SectionBlockProps = {
  /** enum 7종 또는 직접 입력한 라벨(02 §5.4 — Tag·Refrain 등 예외 대응) */
  label: SectionLabel | string;
  /** 같은 라벨의 등장 순서. 있으면 "Verse 2"처럼 적는다 */
  ordinal?: number;
  /** 빈 섹션 허용 — "16 Bar" 같은 연주 메모만 있는 섹션이 실제로 있다 */
  lyrics?: string;
  /** 정렬·삭제 등 블록 조작 (M2) */
  controls?: ReactNode;
  /**
   * 가사가 빈 섹션에 적을 안내. **공개 지면에서는 null**이다 — 빈 섹션은 연주 구간이고,
   * "가사를 적어보세요"는 읽는 사람에게 할 말이 아니다(실제로 공개 지면에 새어 나갔다).
   */
  emptyLabel?: string | null;
  className?: string;
};

/**
 * **이 컴포넌트는 공개 지면에도 쓰인다**(components/public/PraiseView). 그래서 색은 전부
 * 토큰이어야 한다 — 하드코딩(#fffefa)이던 동안 찬양 상세의 가사 판이 다크모드에서 크림색으로
 * 굳어 있었다. 관리 화면 컴포넌트라고 생각하고 라이트 값을 박으면 그 지면이 깨진다.
 */
export function SectionBlock({
  label,
  ordinal,
  lyrics,
  controls,
  emptyLabel = "가사를 적어보세요",
  className,
}: SectionBlockProps) {
  return (
    <section className={cn("group border border-edge bg-surface-sheet", className)}>
      <header className="flex items-center gap-2 border-b border-dashed border-edge px-3 py-[9px]">
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
      {/*
        **그릴 것이 없으면 상자도 없다.** 공개 지면은 `emptyLabel`을 주지 않으므로 연주 구간
        (`Intro`·`Interlude`)에서 `min-h`만 남은 **빈 52px 상자**가 섰다 — 그 상자가 가사 상자와
        같은 생김새라 "여기 가사가 빠졌나"로 읽혔다. 라벨 줄만 남기면 그게 연주 구간이라는 뜻이
        그대로 읽힌다(전수조사 디자인 5-5).

        마디 수를 적어 둔 섹션은 그 글자가 가사 자리에 그대로 나온다(`"4 Bar"` — `praiseForm`).
        에디터는 `emptyLabel`이 있으므로 빈 칸이 그대로 서고, 그쪽은 적으라는 뜻이라 맞다.
      */}
      {(lyrics || emptyLabel) && (
        <p
          className={cn(
            "min-h-[52px] whitespace-pre-line px-[13px] py-[11px] font-serif text-sm leading-body",
            lyrics ? "text-ink" : "text-faint",
          )}
        >
          {lyrics || emptyLabel}
        </p>
      )}
    </section>
  );
}
