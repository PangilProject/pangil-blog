/**
 * 통계 화면의 관측 단위 (A-09).
 *
 * 처음에는 기간(7·30·90일)과 단위(일·주·월)를 따로 뒀는데 **서로 모순됐다** — 기간을 7일로
 * 골라도 차트는 30칸을 그렸다. 그래서 하나로 합쳤다: 단위가 창 크기까지 정한다(티스토리
 * 통계의 일간·주간·월간 탭과 같은 구조). **조작 장치가 둘이면 그중 하나는 반드시 거짓말을
 * 한다.**
 *
 * 이 파일이 `lib`에 있는 이유는 화면(components)과 집계(lib/db)가 **같은 값을 봐야** 하기
 * 때문이다. 한쪽에 두면 다른 쪽이 그쪽을 import하게 되고 층이 거꾸로 선다.
 */

export const UNITS = ["day", "week", "month"] as const;
export type Unit = (typeof UNITS)[number];

export const UNIT_LABELS: Record<Unit, string> = { day: "일", week: "주", month: "월" };

/** 단위별 관측 창. 목록·표 패널도 이 값을 쓴다 — 패널마다 기간이 다르면 화면을 못 믿는다 */
export const UNIT_WINDOW_DAYS: Record<Unit, number> = { day: 30, week: 84, month: 365 };

/** 단위별 막대 개수 상한 */
export const UNIT_BUCKETS: Record<Unit, number> = { day: 30, week: 12, month: 12 };

/** 쿼리스트링은 남이 쓴 값이다 — 허용 목록에 없으면 일 단위로 되돌린다 */
export function parseUnit(value: string | string[] | undefined): Unit {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "week" || raw === "month" ? raw : "day";
}
