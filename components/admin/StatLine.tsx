import type { SeriesPoint } from "@/lib/db/statSummary";
import type { Unit } from "@/lib/stats/range";
import { cn } from "@/lib/utils";

/**
 * 조회 시계열 — 점을 이은 선 (A-09).
 *
 * **막대에서 선으로 바꿨다(2026-09-06).** 막대는 "어느 날이 컸나"를 답하는 데는 좋았지만
 * 30칸을 세워 놓으면 격자 벽처럼 보이고, 무엇보다 **추이**가 안 읽혔다 — 이 화면이 실제로
 * 답해야 하는 질문은 "늘고 있나"다. 티스토리 통계가 선인 것도 그래서다.
 *
 * 대가: 막대는 지면별로 색을 쌓아 그날의 구성을 보여줄 수 있었는데 선은 총합 하나다.
 * 그 구성은 툴팁이 그대로 말한다(기술·묵상·소개) — 한눈에 보이던 것이 한 단계 뒤로 갔다.
 *
 * **여전히 클라이언트 JS가 0이다.** 선은 SVG `polyline` 하나, 점은 div, 툴팁은 CSS hover다.
 * 툴팁을 직접 만들면 그 순간 이 화면에 상태가 생기고 아일랜드가 하나 늘어난다.
 *
 * 축은 **모든 날짜**를 적는다. 솎아내면 어느 점이 며칠인지 세어야 한다. 월은 맨 왼쪽과
 * 달이 바뀌는 자리에만 붙인다 — 30칸에 `9/8`을 서른 번 적으면 숫자들이 서로를 가린다.
 */

/** 그래프 안쪽 여백(%). 위를 비워야 가장 큰 점이 잘리지 않고, 아래는 0인 날의 점 자리다 */
const TOP_PAD = 8;
const BOTTOM_PAD = 6;

export function StatLine({ points, unit }: { points: SeriesPoint[]; unit: Unit }) {
  /**
   * **두 선이 한 판에 겹친다.** 조회만 보면 "많이 읽혔다"와 "많이들 왔다"가 구별되지 않는다 —
   * 한 사람이 열 편을 본 날과 열 사람이 한 편씩 본 날은 조회 선에서 같은 높이다. 두 선의
   * **간격**이 그 답이고, 나란한 두 판으로 나눠 그리면 그 간격이 안 보인다.
   *
   * 눈금은 조회에 맞춘다. 방문자는 언제나 조회 이하이므로(한 사람이 최소 한 번은 본다)
   * 한 눈금에 둘을 얹어도 방문자 선이 위로 넘치지 않는다.
   */
  const max = Math.max(...points.map((point) => point.views), 0);

  // 방문자는 하루 단위에만 있다(05 §4.2). 없는 단위에서는 선을 그리지 않는다 —
  // 0으로 눕힌 선을 그리면 "아무도 안 왔다"로 읽힌다
  const hasVisitors = points.some((point) => point.visitors !== null);

  return (
    <div className="flex flex-col gap-2">
      {/* 두 선이 겹쳐 있으므로 어느 쪽이 무엇인지 여기서 말한다 */}
      <div className="flex items-center gap-3 font-typewriter text-[10px] text-faint">
        <Legend label="조회" className="bg-(--accent)" />
        {hasVisitors && <Legend label="방문자" className="bg-ink-soft" dashed />}
      </div>

      <div className="relative h-[168px]">
        {/*
          선. `preserveAspectRatio="none"`로 칸 수·높이에 맞춰 늘리고, 선 굵기만
          `vector-effect`로 지킨다 — 안 그러면 칸이 많은 달에 선이 실처럼 얇아진다.
        */}
        {points.length > 1 && (
          <svg
            aria-hidden
            className="absolute inset-0 h-full w-full"
            viewBox={`0 0 ${points.length} 100`}
            preserveAspectRatio="none"
          >
            {/* 방문자를 먼저 그린다 — 겹치는 자리에서 조회 선이 위에 오게 */}
            {hasVisitors && (
              <polyline
                points={pathOf(points, "visitors", max)}
                fill="none"
                className="text-ink-soft"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeDasharray="3 3"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            )}

            <polyline
              points={pathOf(points, "views", max)}
              fill="none"
              className="text-(--accent)"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}

        <div className="absolute inset-0 flex">
          {points.map((point, index) => {
            const isLast = index === points.length - 1;

            return (
              <div key={point.key} className="group relative min-w-0 flex-1">
                {/*
                  점. 칸의 가운데에 놓고 값 높이만큼 올린다 — 선의 x좌표와 같은 자리여야
                  선과 점이 어긋나지 않는다.
                */}
                {hasVisitors && (
                  <span
                    className="absolute left-1/2 size-[6px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-ink-soft bg-card"
                    style={{ top: `${yOf(point.visitors ?? 0, max)}%` }}
                  />
                )}

                {/*
                  **평소는 빈 원, 오늘만 채운 원.** 전부 채우면 30개가 같은 무게로 늘어서
                  어느 날을 보고 있는지가 선에 묻힌다 — 채움을 하나만 남겨 그 자리를 만든다.
                */}
                <span
                  className={cn(
                    "absolute left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full",
                    "border-[1.5px] border-(--accent)",
                    isLast ? "size-[8px] bg-(--accent)" : "size-[7px] bg-card",
                  )}
                  style={{ top: `${yOf(point.views, max)}%` }}
                />

                <div
                  role="tooltip"
                  className={cn(
                    "pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 -translate-y-full",
                    "mt-[-12px] hidden w-max border border-edge bg-card px-2.5 py-2",
                    "font-typewriter text-[10.5px] text-ink shadow-card group-hover:block",
                  )}
                  style={{ top: `${yOf(point.views, max)}%` }}
                >
                  <Tooltip point={point} previous={points[index - 1]} unit={unit} />
                </div>

                {/* 점이 작아도 칸 전체가 hover 대상이어야 한다 — 5px를 겨냥할 수는 없다 */}
                <div aria-hidden className="absolute inset-0" />
              </div>
            );
          })}
        </div>
      </div>

      {/* **모든 날짜를 적는다.** 솎아내면 어느 점이 며칠인지 세어야 한다 — 그건 읽는 일이다 */}
      <div className="flex gap-[1px] font-typewriter text-[9px] text-faint">
        {points.map((point, index) => (
          <span key={point.key} className="min-w-0 flex-1 text-center">
            {labelOf(points, index, unit)}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * 점의 x좌표. **칸의 가운데다.**
 *
 * 처음에는 viewBox를 `0 0 (n-1) 100`으로 두고 x를 칸 인덱스로 썼는데, 점은 flex 칸의
 * 가운데(`(i+0.5)/n`)에 있고 선은 `i/(n-1)`에 있어서 **선이 점을 지나가지 않았다** —
 * 양 끝에서 반 칸씩 벌어졌다. viewBox 폭을 칸 수로 맞추고 x에 0.5를 더하면 둘이 같은 자리다.
 */
function xOf(index: number): number {
  return index + 0.5;
}

/** 한 계열의 polyline 좌표. 방문자가 없는 칸은 0으로 둔다 */
function pathOf(points: SeriesPoint[], metric: "views" | "visitors", max: number): string {
  return points
    .map((point, index) => {
      const value = metric === "visitors" ? (point.visitors ?? 0) : point.views;
      return `${xOf(index)},${yOf(value, max)}`;
    })
    .join(" ");
}

function Legend({
  label,
  className,
  dashed,
}: {
  label: string;
  className: string;
  dashed?: boolean;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        aria-hidden
        className={cn("h-[2px] w-[14px]", className, dashed && "opacity-70")}
        style={
          dashed
            ? { maskImage: "repeating-linear-gradient(to right, #000 0 3px, transparent 3px 6px)" }
            : undefined
        }
      />
      {label}
    </span>
  );
}

/** 값 → 위에서부터의 거리(%). 0이면 바닥, 최대면 위쪽 여백 아래 */
function yOf(views: number, max: number): number {
  const ratio = max > 0 ? views / max : 0;
  return TOP_PAD + (100 - TOP_PAD - BOTTOM_PAD) * (1 - ratio);
}

function startsMonth(points: SeriesPoint[], index: number): boolean {
  const previous = points[index - 1];
  if (!previous) return false;
  return monthOf(points[index]?.key) !== monthOf(previous.key);
}

function monthOf(key: string | undefined): string {
  return key?.slice(0, 7) ?? "";
}

/**
 * 축 글자. 일별에서는 일자만 적고, **맨 왼쪽과 달이 바뀌는 자리에만** 월을 붙인다.
 * 주·월 단위는 조회 쪽이 이미 사람이 읽을 라벨을 만들어 준다.
 */
function labelOf(points: SeriesPoint[], index: number, unit: Unit): string {
  const point = points[index];
  if (!point) return "";
  if (unit !== "day") return point.label;

  const day = Number(point.key.slice(8, 10));
  return index === 0 || startsMonth(points, index)
    ? `${Number(point.key.slice(5, 7))}/${day}`
    : String(day);
}

/** 기술도 묵상도 아닌 조회 — 소개 지면(hub)이다. 빼서 구하므로 셋의 합이 총합과 같다 */
function otherViews(point: SeriesPoint): number {
  return Math.max(0, point.views - point.faithViews - point.devViews);
}

/**
 * 툴팁 (A-09).
 *
 * **한 줄로 이어 적던 것을 표로 세웠다.** `2026-09-06 · 조회 10 · 기술 6 · 묵상 3`처럼
 * 가운뎃점으로 잇자 무엇이 값이고 무엇이 이름인지 눈이 갈라내야 했다 — 숫자가 여섯 개면
 * 그건 읽는 일이 된다.
 *
 * 이름과 값을 열로 세우고, **앞 칸과의 차이를 함께 적는다.** 그 차이가 이 화면의 질문이다
 * ("늘고 있나"). 0은 색을 입히지 않는다 — 변화가 없는 것은 좋은 일도 나쁜 일도 아니다
 * (Tile의 증감선과 같은 규칙).
 */
function Tooltip({
  point,
  previous,
  unit,
}: {
  point: SeriesPoint;
  /** 바로 앞 칸. 첫 칸에는 없다 */
  previous: SeriesPoint | undefined;
  unit: Unit;
}) {
  const split = [
    point.devViews > 0 ? `기술 ${point.devViews}` : null,
    point.faithViews > 0 ? `묵상 ${point.faithViews}` : null,
    otherViews(point) > 0 ? `소개 ${otherViews(point)}` : null,
  ].filter((part): part is string => part !== null);

  return (
    <div className="flex flex-col gap-1.5">
      <p className="font-bold text-[11px]">{headingOf(point, unit)}</p>

      <dl className="flex flex-col gap-0.5">
        <Row label="조회" value={point.views} previous={previous?.views} />
        {/* 방문자는 하루 단위에만 있다 — 주·월은 여러 날을 이을 수 없다(05 §4.2) */}
        {point.visitors !== null && (
          <Row label="방문자" value={point.visitors} previous={previous?.visitors ?? undefined} />
        )}
      </dl>

      {split.length > 0 && <p className="text-[9.5px] text-faint">{split.join(" · ")}</p>}
    </div>
  );
}

function Row({
  label,
  value,
  previous,
}: {
  label: string;
  value: number;
  previous: number | undefined;
}) {
  const delta = previous === undefined ? null : value - previous;

  return (
    <div className="flex items-baseline gap-2">
      <dt className="w-[34px] flex-none text-faint">{label}</dt>
      <dd className="flex-1 text-right font-bold tabular-nums">{value.toLocaleString("ko-KR")}</dd>
      <dd className="w-[38px] flex-none text-right tabular-nums">
        {delta === null ? (
          "\u00a0"
        ) : (
          <span className={delta === 0 ? "text-faint" : delta > 0 ? "text-ok" : "text-(--accent)"}>
            {delta > 0 ? "▲" : delta < 0 ? "▼" : "±"}
            {Math.abs(delta).toLocaleString("ko-KR")}
          </span>
        )}
      </dd>
    </div>
  );
}

/** 툴팁 머리글. 일별은 사람이 읽는 날짜로, 주·월은 조회가 만든 라벨을 쓴다 */
function headingOf(point: SeriesPoint, unit: Unit): string {
  if (unit !== "day") {
    return unit === "week" ? `${point.label} 주` : point.label;
  }

  return `${Number(point.key.slice(5, 7))}월 ${Number(point.key.slice(8, 10))}일`;
}
