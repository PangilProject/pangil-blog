import type { CSSProperties, ReactNode } from "react";

import type { HubPaper } from "@/lib/site/hubContent";
import { cn } from "@/lib/utils";

/**
 * 허브의 한 장면 (ADR-004).
 *
 * `data-scene`이 그 구간의 종이를 정한다 — 배경만이 아니라 먹색·보조색·괘선·그림자가 함께
 * 갈린다(globals.css). **매 순간 화면은 단색이다**: 금지한 것은 한 화면 안에서 색이 흐르는
 * 장식이고(03 §1.1), 여기서 바뀌는 것은 장면과 장면 사이다.
 *
 * 장면은 화면 폭을 꽉 채우고, 안쪽에서만 읽기 폭으로 좁힌다 — 그래야 종이가 갈린 것이 보인다.
 *
 * **2단계에서 이 위에 연출이 얹힌다.** 그때 JS가 `--paper` 계열을 스크롤에 따라 보간하지만,
 * 이 컴포넌트가 정한 값이 그 폴백이다. 스크립트가 죽어도, `prefers-reduced-motion`이어도
 * 장면은 여기 적힌 대로 선다.
 */
/**
 * 장면의 목표 명암. 0 = 종이, 1 = 먹.
 * 2단계 연출이 이 값들 사이를 스크롤에 따라 보간한다 — 정적 `data-scene`이 그 폴백이다.
 */
const TONE_BY_PAPER: Record<HubPaper, number> = {
  paper: 0,
  trace: 0.08,
  ink: 0.88,
  shelf: 1,
};

export function HubScene({
  paper,
  slug,
  children,
  className,
  id,
  steps,
  stepHeight = 90,
}: {
  paper: HubPaper;
  /** 장면 머리의 라벨 — "장 하나 · 문장" */
  slug?: string;
  children: ReactNode;
  className?: string;
  id?: string;
  /**
   * 이 장면이 **머무는 구간**이면 항목 수를 준다. 화면이 고정된 채 스크롤이 재생 헤드가 되고,
   * 항목이 하나씩 갈아 끼워진다(ADR-004 결정 2 · sticky pin).
   *
   * **연출이 없으면 이 값은 아무 일도 하지 않는다.** `data-hub-live`가 없는 동안 장면은
   * 그냥 세로로 쌓인 문서이고, 항목은 전부 보인다 — 그게 폴백이다.
   */
  steps?: number;
  /** 항목 하나가 차지하는 스크롤 길이(svh). 읽을 것이 많은 장면은 길게 준다 */
  stepHeight?: number;
}) {
  const isTrack = typeof steps === "number" && steps > 0;

  return (
    <section
      id={id}
      data-scene={paper === "paper" ? undefined : paper}
      data-hub-scene={id}
      data-tone={TONE_BY_PAPER[paper]}
      data-hub-track={isTrack ? "" : undefined}
      style={
        isTrack
          ? ({
              "--steps": steps,
              "--step-h": `${stepHeight}svh`,
            } as CSSProperties)
          : undefined
      }
      className={cn(
        "relative w-full bg-paper text-ink",
        // 장면 경계에 한 겹 그늘 — 종이가 겹쳐 놓인 것처럼 보이게 한다
        "before:absolute before:inset-x-0 before:top-0 before:h-3.5 before:bg-linear-to-b before:from-black/12 before:to-transparent before:content-['']",
        "first:before:hidden",
        "py-[clamp(72px,12vw,132px)]",
        className,
      )}
    >
      <div data-hub-stage={isTrack ? "" : undefined}>
        {/* `min-w-0`이 없으면 이 칸의 최소 폭이 **내용 폭**이 되어 무대를 밀어낸다 */}
        <div className="mx-auto w-full min-w-0 max-w-[1000px] px-[6%] lg:px-10">
          {slug && (
            <p className="mb-5 flex items-center gap-3 font-typewriter text-[10.5px] tracking-[0.2em] text-site-accent">
              <span data-hub-slug>{slug}</span>
              <span aria-hidden className="h-px max-w-[200px] flex-1 bg-edge" />
            </p>
          )}
          {children}
        </div>
      </div>
    </section>
  );
}

/**
 * 장면마다 한 문장씩 크게 세운다. 03 §2.2가 제목을 세리프로 고정했고, 이 지면에서는
 * 그 목소리가 가장 크다.
 */
export function HubStatement({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2
      className={cn(
        // `hub-statement`는 조판용 클래스가 아니라 **잡을 손잡이**다 —
        // 좁은 화면에서 크기를 내리려면 이름이 있어야 한다(globals.css)
        "hub-statement max-w-[19ch] text-balance font-serif font-bold leading-[1.34] tracking-[-0.015em]",
        "text-[clamp(26px,5vw,52px)]",
        className,
      )}
    >
      {children}
    </h2>
  );
}
