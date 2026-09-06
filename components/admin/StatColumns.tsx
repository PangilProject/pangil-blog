import type { SeriesPoint } from "@/lib/db/statSummary";
import type { Unit } from "@/lib/stats/range";
import { cn } from "@/lib/utils";

/**
 * 세로 막대 시계열 (A-09) — 티스토리 통계의 방문 그래프 형태.
 *
 * 가로 막대를 세로로 쌓으면 30칸부터 화면을 넘어가고 90칸은 볼 수 없다. 시간축을 가로로
 * 눕히면 칸이 늘어도 한눈에 들어온다 — 이 화면이 답해야 하는 질문이 "어느 날이 컸나"이기
 * 때문이다.
 *
 * **여전히 클라이언트 JS가 0이다.** 막대는 div 높이고, 값 표시는 `title` 속성이다.
 * 툴팁을 직접 만들면 그 순간 이 화면에 상태가 생기고 아일랜드가 하나 늘어난다.
 */

export function StatColumns({ points, unit }: { points: SeriesPoint[]; unit: Unit }) {
  const max = Math.max(...points.map((point) => point.views), 0);

  // 칸이 많으면 라벨을 솎는다. 30칸에 라벨 30개를 적으면 글자가 겹쳐 아무것도 안 읽힌다
  const labelEvery = points.length > 20 ? 5 : points.length > 12 ? 2 : 1;

  return (
    <div className="flex flex-col gap-2">
      {/*
        툴팁이 위로 넘쳐야 하므로 이 컨테이너를 자르지 않는다.
        브라우저 기본 `title`을 쓰지 않는 이유는 **1초쯤 기다려야 뜨기 때문**이다 — 그건
        "올리면 나온다"가 아니고, 실제로 안 나온다고 느껴진다. CSS hover면 즉시 뜨고
        조판도 우리 것을 쓴다. 여전히 클라이언트 JS는 0이다.
      */}
      <div className="flex h-[132px] items-end gap-[3px]">
        {points.map((point) => (
          <div
            key={point.key}
            className="group relative flex h-full min-w-0 flex-1 flex-col justify-end"
          >
            {/*
              막대 묶음만큼의 높이를 갖는 안쪽 상자. 툴팁을 **여기** 위에 붙여야 막대 끝에
              붙는다 — 칸(132px) 기준으로 붙이면 낮은 막대에서는 툴팁이 허공에 떠 보인다.
            */}
            <div className="relative w-full" style={{ height: stackHeight(point.views, max) }}>
              <div
                role="tooltip"
                className={cn(
                  "pointer-events-none absolute bottom-[calc(100%+7px)] left-1/2 z-10",
                  "-translate-x-1/2 hidden whitespace-nowrap border border-edge bg-card",
                  "px-2 py-1 font-typewriter text-[10px] text-ink shadow-card group-hover:block",
                )}
              >
                {tooltipOf(point, unit)}
                {/* 꼬리 — 어느 막대의 값인지 가리킨다. 테두리 두 변만 남겨 삼각형처럼 보인다 */}
                <span
                  aria-hidden
                  className="absolute top-full left-1/2 -ml-[4px] -mt-[4px] size-2 rotate-45 border-edge border-r border-b bg-card"
                />
              </div>

              {/* 묵상을 위, 기술을 아래에 둔다. 순서가 매번 다르면 비교가 안 된다.
                  안쪽 비율이므로 분모는 그날의 합이다 */}
              <div
                style={{ height: shareOf(point.faithViews, point.views) }}
                className="w-full bg-accent-faith"
              />
              <div
                style={{ height: shareOf(point.devViews, point.views) }}
                className="w-full bg-accent-dev"
              />
              {/*
                두 지면이 아닌 조회 — 소개 지면이다. **이 칸이 없으면 막대가 짧게 그려진다**:
                상자 높이는 그날의 전체 조회로 잡는데 칠하는 것은 둘뿐이라, 소개를 본 날마다
                그 차이만큼 위가 비었다.

                빼서 구한다. 지면을 하나 더 조회해 오는 것보다 이쪽이 **어긋날 수 없다** —
                칠한 것의 합이 언제나 상자를 채운다.
              */}
              <div
                style={{ height: shareOf(otherViews(point), point.views) }}
                className="w-full bg-edge-strong"
              />
            </div>

            {/* 0인 칸도 바닥선을 남긴다 — 칸이 사라지면 "그날은 없었다"로 읽힌다 */}
            {point.views === 0 && <div className="h-px w-full bg-edge" />}

            {/* 막대가 낮은 날에도 칸 전체가 hover 대상이어야 한다 — 1건인 날의 2px를
                겨냥할 수는 없다 */}
            <div aria-hidden className="absolute inset-0" />
          </div>
        ))}
      </div>

      <div className="flex gap-[3px] font-typewriter text-[9.5px] text-faint">
        {points.map((point, index) => (
          <span key={point.key} className="min-w-0 flex-1 text-center">
            {index % labelEvery === 0 || index === points.length - 1 ? point.label : " "}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * 막대 묶음의 높이. 1 이상이면 최소 3px은 보이게 한다 — 큰 날 옆에서 1건이 아예 안 보이면
 * 0과 구별되지 않고, 그러면 "그날은 아무도 안 왔다"로 읽힌다.
 */
function stackHeight(views: number, max: number): string {
  if (views <= 0) return "0px";
  return `max(3px, ${(views / Math.max(max, 1)) * 100}%)`;
}

/**
 * 기술도 묵상도 아닌 조회 — 소개 지면(hub)이다.
 *
 * 지면을 따로 세어 오지 않고 **빼서 구한다.** 그래야 세 조각의 합이 언제나 그날의 전체
 * 조회와 같고, 나중에 지면이 늘어도 막대가 조용히 짧아지지 않는다.
 */
function otherViews(point: SeriesPoint): number {
  return Math.max(0, point.views - point.faithViews - point.devViews);
}

/** 묶음 안에서 지면이 차지하는 비율 */
function shareOf(value: number, total: number): string {
  if (value <= 0 || total <= 0) return "0";
  return `${(value / total) * 100}%`;
}

function tooltipOf(point: SeriesPoint, unit: Unit): string {
  const parts = [`${point.key} · 조회 ${point.views}`];

  if (point.devViews > 0) parts.push(`기술 ${point.devViews}`);
  if (point.faithViews > 0) parts.push(`묵상 ${point.faithViews}`);
  if (otherViews(point) > 0) parts.push(`소개 ${otherViews(point)}`);
  if (point.visitors !== null) parts.push(`방문자 ${point.visitors}`);
  if (unit === "week") parts.push("주 시작일 기준");

  return parts.join(" · ");
}

/**
 * 한 계열짜리 세로 막대 (시간대·요일).
 *
 * 24칸을 가로 막대로 세우면 21칸이 0인 날에도 지면 스무 줄을 차지한다 — 화면을 잡아먹고
 * 정작 "밤에 읽힌다"는 모양은 안 보인다. 시간축을 눕히면 그 모양이 한눈에 들어온다.
 */
export function SimpleColumns({
  points,
  labelEvery = 1,
  height = "h-[92px]",
}: {
  points: { key: string; label: string; value: number; tooltip: string }[];
  /** 칸이 많으면 라벨을 솎는다 */
  labelEvery?: number;
  height?: string;
}) {
  const max = Math.max(...points.map((point) => point.value), 0);

  return (
    <div className="flex flex-col gap-2">
      <div className={cn("flex items-end gap-[3px]", height)}>
        {points.map((point) => (
          <div
            key={point.key}
            className="group relative flex h-full min-w-0 flex-1 flex-col justify-end"
          >
            <div className="relative w-full" style={{ height: stackHeight(point.value, max) }}>
              <div
                role="tooltip"
                className={cn(
                  "pointer-events-none absolute bottom-[calc(100%+7px)] left-1/2 z-10",
                  "-translate-x-1/2 hidden whitespace-nowrap border border-edge bg-card",
                  "px-2 py-1 font-typewriter text-[10px] text-ink shadow-card group-hover:block",
                )}
              >
                {point.tooltip}
                <span
                  aria-hidden
                  className="absolute top-full left-1/2 -ml-[4px] -mt-[4px] size-2 rotate-45 border-edge border-r border-b bg-card"
                />
              </div>
              <div className="h-full w-full bg-(--accent)" />
            </div>
            {point.value === 0 && <div className="h-px w-full bg-edge" />}
            <div aria-hidden className="absolute inset-0" />
          </div>
        ))}
      </div>

      <div className="flex gap-[3px] font-typewriter text-[9.5px] text-faint">
        {points.map((point, index) => (
          <span key={point.key} className="min-w-0 flex-1 text-center">
            {index % labelEvery === 0 ? point.label : " "}
          </span>
        ))}
      </div>
    </div>
  );
}
