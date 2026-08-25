import type { ReactNode } from "react";

import { Punch } from "@/components/record/Punch";
import type { RecordType } from "@/lib/record/callNumber";
import { formatCallNumber } from "@/lib/record/callNumber";
import { cn } from "@/lib/utils";

/**
 * 상세 지면 (03 §5.2) — "카드 → 펼쳐진 지면"의 연속성.
 *
 * 목록 카드에 있던 것이 그대로 온다: 상단 괘, 청구기호, 하단 천공. 카드를 눌러 들어온
 * 사람이 같은 물건의 안쪽을 보고 있다고 느껴야 한다(04 §3.5 — 목록 카드 = 상세 지면 = OG 카드).
 *
 * 지면 폭은 본문 가독 폭(--container-measure)에 맞춘다. 기술 글의 목차는 이 지면 밖
 * 우측 여백에 서므로(04 §3.4) 이 컴포넌트는 폭만 정하고 여백은 라우트가 정한다.
 */
export function RecordSheet({
  type,
  callNumber,
  publishedAt,
  title,
  subtitle,
  meta,
  children,
  className,
  postId,
}: {
  type: RecordType;
  callNumber: number | null;
  /** 발행일 표기 — 기록물의 날짜는 절대 표기다(상대 시각은 관리 화면에만) */
  publishedAt: string | null;
  title: string;
  /** 말씀 범위·카테고리 등 제목 아래 한 줄 */
  subtitle?: ReactNode;
  /** 태그 등 지면 하단 메타 */
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
  /**
   * 이 지면이 보여주는 글의 id. 통계 비콘이 DOM에서 읽어 간다(05 §4) — 비콘을 레이아웃에
   * 한 번만 두고도 글 단위로 셀 수 있게 하는 유일한 연결이다. 지면마다 비콘을 놓으면
   * 언젠가 두 번 발화한다.
   */
  postId?: string;
}) {
  return (
    <article
      data-post-id={postId}
      className={cn(
        "relative mx-auto w-full max-w-measure border border-edge bg-card px-[7%] pt-9 pb-14 shadow-card",
        className,
      )}
    >
      {/* 상단 괘 — 카드의 그것과 같은 1.5px 액센트 */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-[1.5px] bg-(--accent)" />

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2 font-typewriter text-[11px]">
          <span className="text-(--accent)">{formatCallNumber({ type, callNumber }) ?? ""}</span>
          {publishedAt && <time className="text-faint">{publishedAt}</time>}
        </div>

        <h1 className="font-serif font-bold text-[clamp(20px,3.4vw,26px)] leading-[1.55]">
          {title}
        </h1>

        {subtitle}
      </header>

      <div className="mt-7 flex flex-col gap-6">{children}</div>

      {meta && <footer className="mt-10 border-edge border-t pt-5">{meta}</footer>}

      <Punch />
    </article>
  );
}
