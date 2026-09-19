import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * 기록 카드 (03 §3 시그니처 요소 · §6.2).
 *
 * 붉은/파란 상단 괘(1.5px) + 하늘 괘선(27px 간격) + 청구기호 + 하단 천공, 미세 회전(±1도).
 * hover는 "카드를 집어 든다" — 회전을 0으로 풀고 들어올린다(03 §2.3).
 *
 * 목록 카드 = 상세 지면 = OG 카드가 같은 조판을 쓰는 것이 이 시스템의 축이라(04 §3.5),
 * 여기서 정한 간격·서체 역할은 상세/OG에서도 그대로 재사용한다.
 */

/** 03 §6.2 variants. 액센트를 어디서 가져올지가 실질 차이다. */
export type RecordCardVariant = "faith" | "dev" | "hub" | "today";

/** 03 §6.2 states. hover는 CSS가 처리하므로 prop이 아니다. */
export type RecordCardState = "default" | "empty" | "hidden";

export type RecordCardProps = {
  variant?: RecordCardVariant;
  state?: RecordCardState;
  /** 이미 포맷된 청구기호 문자열 (lib/record/callNumber). 초안이면 비워둔다 */
  callNumber?: string | null;
  /** 우상단 메타 — 날짜 또는 주기 표기 */
  /**
   * 청구기호 옆에 붙는 작은 표시. **도장(overlay)이 아니라 줄 안에 선다** — 카드에 빈
   * 모서리가 없어서, 찍으면 날짜를 덮는다(실제로 덮었다).
   */
  badge?: ReactNode;
  aside?: string | null;
  title: ReactNode;
  /** 말씀 범위·요약 한 줄 */
  subtitle?: ReactNode;
  /** 타입·상태 등 타자기체 메타 한 줄 */
  meta?: ReactNode;
  /** 미세 회전 각도(도). 목록에서 ±1도 범위로 흩뿌린다(03 §5.1) */
  rotate?: number;
  href?: string;
  /** 상태 도장 등 카드 위에 얹는 요소 */
  overlay?: ReactNode;
  children?: ReactNode;
  className?: string;
};

const ACCENT_BY_VARIANT: Record<RecordCardVariant, string> = {
  // faith·dev는 자기 액센트를 고정한다 — 허브에서 두 카드가 나란히 서기 때문(03 §2.1)
  faith: "[--card-accent:var(--accent-faith)]",
  dev: "[--card-accent:var(--accent-dev)]",
  // 허브·오늘의 카드는 지면의 액센트를 따른다
  hub: "[--card-accent:var(--accent)]",
  today: "[--card-accent:var(--accent)]",
};

/** 하늘 괘선 — 27px 간격 (03 §3). empty 상태에서는 깔지 않는다 */
const RULED_LINES =
  "bg-[repeating-linear-gradient(to_bottom,transparent,transparent_26px,var(--line)_27px)]";

export function RecordCard({
  variant = "faith",
  state = "default",
  callNumber,
  badge,
  aside,
  title,
  subtitle,
  meta,
  rotate = 0,
  href,
  overlay,
  children,
  className,
}: RecordCardProps) {
  if (state === "hidden") return null;

  const isEmpty = state === "empty";

  const body = (
    <>
      {(callNumber || aside || badge) && (
        <div className="flex items-center justify-between gap-2 pb-3 font-typewriter text-[10.5px] text-(--card-accent)">
          <span className="flex items-center gap-1.5">
            {callNumber}
            {badge}
          </span>
          <span className="text-faint">{aside}</span>
        </div>
      )}
      <div className="text-[15px] font-bold leading-[27px]">{title}</div>
      {subtitle && (
        <div className="truncate text-[12.5px] leading-[27px] text-ink-soft">{subtitle}</div>
      )}
      {meta && (
        <div className="font-typewriter text-[10.5px] leading-[27px] text-faint">{meta}</div>
      )}
      {children}
    </>
  );

  return (
    <article
      style={rotate ? ({ "--card-rotate": `${rotate}deg` } as CSSProperties) : undefined}
      className={cn(
        "relative rotate-(--card-rotate,0deg) border border-edge bg-card px-5 pt-[18px] pb-[14px]",
        // 상단 괘 — 청구기호 줄 아래에 그어진다
        "before:absolute before:inset-x-0 before:top-10 before:h-[1.5px] before:bg-(--card-accent) before:content-['']",
        "motion-safe:transition-[translate,rotate,box-shadow] motion-safe:duration-300 ease-record",
        ACCENT_BY_VARIANT[variant],
        isEmpty ? "border-dashed" : cn(RULED_LINES, "shadow-card"),
        href && !isEmpty && "hover:-translate-y-[5px] hover:rotate-0 hover:shadow-card-hover",
        className,
      )}
    >
      {overlay}
      {/*
        포커스는 밑줄을 쓰지 않는다 — 카드 바탕이 27px 괘선이라 글줄마다 밑줄이 겹쳐
        무엇이 선택됐는지가 아니라 화면이 고장난 것처럼 보였다. 카드 바깥으로 한 겹 두른다
      */}
      {href ? (
        <Link
          href={href}
          className="block outline-none focus-visible:ring-1 focus-visible:ring-(--accent) focus-visible:ring-offset-2 focus-visible:ring-offset-(--paper)"
        >
          {body}
        </Link>
      ) : (
        body
      )}
    </article>
  );
}
