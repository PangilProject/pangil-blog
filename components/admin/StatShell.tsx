import Link from "next/link";
import type { ReactNode } from "react";

import { UNIT_LABELS, UNITS, type Unit } from "@/lib/stats/range";
import { cn } from "@/lib/utils";

/**
 * 통계 화면의 공용 조각 (A-09).
 *
 * 토글이 **링크**다. 쿼리스트링으로 넘기면 서버가 다시 그리므로 클라이언트 JS가 필요 없고,
 * 뒤로 가기와 새 탭이 그냥 동작한다. 상태를 클라이언트에 두면 그 셋을 다 잃는다.
 */

/**
 * 화면의 유일한 조작 장치 (A-09).
 *
 * 처음에는 기간(7·30·90일)과 단위(일·주·월)를 따로 뒀는데 **서로 모순됐다** — 기간을 7일로
 * 골라도 차트는 30칸을 그렸다. 둘을 하나로 합쳤다: 단위가 창 크기까지 정한다(티스토리 통계의
 * 일간·주간·월간 탭과 같은 구조). 조작 장치가 둘이면 그중 하나는 반드시 거짓말을 한다.
 */
export function UnitTabs({ active, basePath }: { active: Unit; basePath: string }) {
  return (
    <nav className="flex gap-1">
      {UNITS.map((unit) => (
        <Link
          key={unit}
          href={unit === "day" ? basePath : `${basePath}?unit=${unit}`}
          aria-current={unit === active ? "page" : undefined}
          className={cn(
            "border px-2.5 py-1 font-typewriter text-[10.5px] transition-colors duration-150",
            unit === active
              ? "border-edge bg-card text-ink shadow-[inset_0_2px_0_var(--accent)]"
              : "border-transparent text-faint hover:text-ink",
          )}
        >
          {UNIT_LABELS[unit]}
        </Link>
      ))}
    </nav>
  );
}

export function Panel({
  title,
  note,
  action,
  children,
}: {
  title: string;
  note?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-typewriter text-[10.5px] tracking-[0.14em] text-faint">{title}</h2>
        {action}
      </div>

      {/*
        숫자의 한계를 각주로 숨기지 않는다 — 제목 아래에 붙여 둔다.

        설명이 없어도 이 줄의 높이를 차지한다. 패널이 2열로 나란히 설 때 한쪽만 설명이
        있으면 박스 시작 높이가 어긋나고, 그건 정렬이 아니라 실수처럼 보인다.
      */}
      <p className="min-h-[1.6em] text-[11px] text-faint leading-[1.6]">{note ?? "\u00a0"}</p>

      <div className="flex flex-col gap-2 border border-edge bg-card px-4 py-3.5">{children}</div>
    </section>
  );
}

/**
 * 요약 타일.
 *
 * **비교 대상을 별도 칸으로 두지 않는다.** 처음엔 오늘·어제·이번 주·지난주를 각각 칸으로
 * 뒀는데, 6칸이 3열에 들어가면서 "이번 주"와 "지난주"가 줄을 갈라 짝이 깨졌다. 애초에
 * 중복이었다 — 증감선이 이미 비교를 담고 있으므로 직전 값을 그 줄에 함께 적으면 칸이 절반이
 * 되고 짝이 깨질 자리도 없어진다.
 *
 * **증감은 비율이 아니라 개수다.** 조회가 하루 수십 건인 규모에서 비율은 과장한다 — 2에서
 * 6이 되면 "+200%"지만 실제로 일어난 일은 네 명이 더 본 것이다. 개수로 적으면 직전 값이 0일
 * 때의 예외(0 → 5를 "500% 증가"로 적을 수 없다)도 함께 사라진다.
 */
export function Tile({
  label,
  value,
  previous,
  previousLabel,
  sub,
  unit,
}: {
  label: string;
  value: number;
  /** 비교 대상의 값. 증감선에 함께 적는다 */
  previous?: number;
  /** 비교 대상의 이름 — "어제", "지난주" */
  previousLabel?: string;
  /** 비교가 없는 칸의 보조 한 줄 — "수집 14일째" */
  sub?: string;
  /** 숫자 뒤에 붙는 단위 — "건", "일째" */
  unit?: string;
}) {
  const delta = previous === undefined ? null : value - previous;
  const count = (input: number) => input.toLocaleString("ko-KR");

  return (
    <div className="flex flex-col border border-edge bg-card px-4 py-3 shadow-card">
      <p className="font-typewriter text-[10px] tracking-[0.14em] text-faint">{label}</p>
      <p className="mt-1 font-serif text-[24px] leading-none">
        {count(value)}
        {unit && <em className="ml-1 font-typewriter text-[11px] text-faint not-italic">{unit}</em>}
      </p>

      {/* 비교선의 높이를 항상 차지한다 — 어떤 칸은 있고 어떤 칸은 없으면 칸 높이가 들쭉난다 */}
      <p className="mt-1.5 font-typewriter text-[10.5px] text-faint">
        {delta !== null && previous !== undefined ? (
          <>
            {previousLabel} {count(previous)}
            <span className="mx-1.5 text-edge">·</span>
            {/* 0은 색을 입히지 않는다 — 변화가 없는 것은 좋은 일도 나쁜 일도 아니다 */}
            <span className={delta === 0 ? undefined : delta > 0 ? "text-ok" : "text-(--accent)"}>
              {delta > 0 ? "+" : delta < 0 ? "−" : "±"}
              {count(Math.abs(delta))}
            </span>
          </>
        ) : (
          (sub ?? "\u00a0")
        )}
      </p>
    </div>
  );
}

/**
 * 숫자가 아닌 값을 담는 칸 — 날짜, "1분 20초" 같은 것.
 *
 * Tile과 **같은 뼈대를 쓴다.** 손으로 박스를 만들면 padding·글자 크기·비교선 높이가 조금씩
 * 어긋나고, 나란히 섰을 때 그게 눈에 걸린다.
 */
export function TextTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col border border-edge bg-card px-4 py-3 shadow-card">
      <p className="font-typewriter text-[10px] tracking-[0.14em] text-faint">{label}</p>
      <p className="mt-1 font-serif text-[19px] leading-tight">{value}</p>
      <p className="mt-1.5 font-typewriter text-[10.5px] text-faint">{sub ?? "\u00a0"}</p>
    </div>
  );
}

export function EmptyState() {
  return (
    <div className="border border-edge border-dashed bg-card px-5 py-8 text-center">
      <p className="text-[13.5px]">아직 조회가 기록되지 않았어요.</p>
      <p className="mt-2 text-[12px] text-faint leading-[1.8]">
        로그인한 브라우저에서는 내 방문을 세지 않아요.
        <br />
        시크릿 창으로 열어보면 확인할 수 있어요.
      </p>
    </div>
  );
}

/** "1분 20초" — 초만 적으면 200초가 긴지 짧은지 감이 안 온다 */
export function formatSeconds(seconds: number): string {
  const rounded = Math.round(seconds);
  if (rounded < 60) return `${rounded}초`;
  return `${Math.floor(rounded / 60)}분 ${rounded % 60}초`;
}
