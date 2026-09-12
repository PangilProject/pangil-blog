/**
 * 표 칸 색 (03 §1.1 · 05 §2).
 *
 * **자유 색을 주지 않는다.** 이 지면은 종이 한 벌로 조판되고 그라디언트·형광색은 금지
 * 문법이다(03 §1.1). 색을 자유롭게 열면 글마다 다른 표가 생기고, 그건 다크 모드에서
 * 제일 먼저 깨진다.
 *
 * 그래서 **토큰 이름만 저장한다.** `#f0e9d8` 같은 값을 저장하면 나중에 팔레트를 고칠 때
 * 이미 발행된 글은 옛 색으로 남는다 — 이름을 저장하면 조판이 따라온다.
 */
export const TABLE_CELL_COLORS = ["none", "accent", "muted"] as const;

export type TableCellColor = (typeof TABLE_CELL_COLORS)[number];

export const TABLE_CELL_COLOR_LABELS: Record<TableCellColor, string> = {
  none: "없음",
  accent: "강조",
  muted: "회색",
};

/** 저장값 → 토큰. 모르는 값은 색 없음으로 읽는다 — 옛 글이나 손으로 고친 값이 들어와도 안전하다 */
export function toCellColor(value: unknown): TableCellColor | null {
  return TABLE_CELL_COLORS.includes(value as TableCellColor) && value !== "none"
    ? (value as TableCellColor)
    : null;
}

/** 화면에 붙는 클래스. 에디터와 공개 지면이 같은 것을 쓴다 */
export function cellColorClass(value: unknown): string | undefined {
  const color = toCellColor(value);
  if (color === null) return undefined;

  return color === "accent" ? "cell-accent" : "cell-muted";
}
