import { cn } from "@/lib/utils";

/**
 * 막대 (A-09).
 *
 * **차트 라이브러리를 들이지 않는다.** 이 화면이 필요한 것은 눈금이 정확한 그래프가 아니라
 * "어느 쪽이 큰가"를 한눈에 보는 것이고, 그건 div 폭 하나로 된다. 의존성 최소화(00 §6.3)가
 * 유지보수 방어의 핵심이라 여기서 라이브러리를 늘리면 그게 나중에 부패한다.
 *
 * 03 §1.1 금지 문법을 지킨다 — 그라디언트 없음, radius 0.
 */

export type BarSegment = {
  value: number;
  /** 액센트 토큰 클래스. 라이트·다크가 함께 따라온다 */
  className: string;
  label: string;
};

export function StatBar({
  label,
  segments,
  max,
  note,
  labelWidth = "w-[86px]",
}: {
  label: string;
  /** 한 칸이면 단색, 둘 이상이면 쌓인다 */
  segments: BarSegment[];
  max: number;
  note?: string;
  labelWidth?: string;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  return (
    <div className="flex items-center gap-3">
      <span
        className={cn("flex-none font-typewriter text-[10.5px] text-faint", labelWidth)}
        title={label}
      >
        {label}
      </span>

      <div className="flex h-[18px] min-w-0 flex-1 bg-surface-tab">
        {segments.map((segment) => (
          <div
            key={segment.label}
            // max가 0이면 0으로 나눈다 — 표본이 없을 때 화면이 깨지는 것이 가장 흔한 첫 버그다
            style={{ width: max > 0 ? `${(segment.value / max) * 100}%` : "0%" }}
            className={cn("h-full transition-[width] duration-300 ease-record", segment.className)}
            title={`${segment.label} ${segment.value}`}
          />
        ))}
      </div>

      <span className="w-[92px] flex-none text-right font-typewriter text-[11px] text-ink">
        {total.toLocaleString("ko-KR")}
        {note && <em className="ml-1.5 text-[10px] text-faint not-italic">{note}</em>}
      </span>
    </div>
  );
}

/** 지면 색은 한 곳에서 정한다 — 화면마다 다르면 그게 프리모템 #12다 */
export const SITE_BAR = {
  dev: "bg-accent-dev",
  faith: "bg-accent-faith",
  plain: "bg-(--accent)",
} as const;

/** 범례. 색만 있고 이름이 없으면 무슨 색인지 매번 추측하게 된다 */
export function BarLegend({ items }: { items: { label: string; className: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-3 font-typewriter text-[10px] text-faint">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span aria-hidden className={cn("inline-block h-2 w-2.5", item.className)} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
