import { cn } from "@/lib/utils";

/**
 * 한 계열짜리 세로 막대 (시간대·요일).
 *
 * 24칸을 가로 막대로 세우면 21칸이 0인 날에도 지면 스무 줄을 차지한다 — 화면을 잡아먹고
 * 정작 "밤에 읽힌다"는 모양은 안 보인다. 시간축을 눕히면 그 모양이 한눈에 들어온다.
 *
 * 시계열이 선으로 바뀐 뒤에도(StatLine) 여기는 막대로 남는다. 시간대·요일은 **비교가
 * 아니라 분포**라, 24칸을 선으로 이으면 없는 연속성을 그린 것이 된다 — 23시와 0시가
 * 이어진 것처럼 보인다.
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

/**
 * 막대 높이. 1 이상이면 최소 3px은 보이게 한다 — 큰 날 옆에서 1건이 아예 안 보이면
 * 0과 구별되지 않고, 그러면 "그날은 아무도 안 왔다"로 읽힌다.
 *
 * 시계열은 선으로 바뀌었지만(StatLine) 시간대·요일 분포는 **비교가 아니라 분포**라
 * 막대가 맞다 — 24칸을 선으로 이으면 없는 연속성을 그린 것이 된다.
 */
function stackHeight(value: number, max: number): string {
  if (value <= 0) return "0px";
  return `max(3px, ${(value / Math.max(max, 1)) * 100}%)`;
}
