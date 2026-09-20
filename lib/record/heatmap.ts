/**
 * 발행 달력의 순수 계산 (ADR-004 · H-01 기록 장면).
 *
 * **DB를 모른다.** 조회는 `lib/db/publishHeatmap`이 하고 여기서는 날짜만 다룬다 —
 * 붙여 두면 격자 계산 하나를 확인하려고 데이터베이스가 있어야 한다.
 */

/** 53주 × 7일 — 격자가 정확히 채워지는 길이 */
export const HEATMAP_DAYS = 371;

export type PublishDay = {
  /** `YYYY-MM-DD` (KST) */
  date: string;
  count: number;
};

/**
 * 격자에 그릴 칸들. **빈 날도 칸을 차지한다** — 비어 있는 줄이 보여야 "매일"이 사실인지
 * 아닌지가 읽힌다. 채워진 날만 늘어놓으면 어떤 달력이든 빽빽해 보인다.
 *
 * 오늘이 마지막 칸이 되도록 뒤에서부터 채운다.
 */
export function toHeatmapCells(days: PublishDay[], today: Date): PublishDay[] {
  const byDate = new Map(days.map((day) => [day.date, day.count]));
  const cells: PublishDay[] = [];

  for (let i = HEATMAP_DAYS - 1; i >= 0; i--) {
    const at = new Date(today);
    at.setUTCDate(at.getUTCDate() - i);
    const date = at.toISOString().slice(0, 10);
    cells.push({ date, count: byDate.get(date) ?? 0 });
  }

  return cells;
}

/** 칸의 농도 0~3. 하루 4장 이상 쓰는 날은 드물어 4단계면 충분하다 */
export function heatLevel(count: number): 0 | 1 | 2 | 3 {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  return 3;
}

/**
 * 가장 길게 이어 쓴 날 수. **"매일"이 사실인지를 한 숫자로 말한다** —
 * 통산 장수는 열심히 몰아 쓴 사람도 채울 수 있지만, 이어 쓴 날은 그럴 수 없다.
 *
 * 오늘이 아직 비어 있어도 끊긴 것으로 세지 않는다 — 하루가 끝나지 않았다.
 */
export function longestStreak(cells: PublishDay[]): number {
  let best = 0;
  let run = 0;

  for (const cell of cells) {
    if (cell.count > 0) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }

  return best;
}

/** 지금 이어 오고 있는 날 수. 오늘이 비었으면 어제까지로 센다 */
export function currentStreak(cells: PublishDay[]): number {
  let run = 0;

  for (let i = cells.length - 1; i >= 0; i--) {
    const cell = cells[i];
    if (cell.count > 0) {
      run += 1;
      continue;
    }
    // 마지막 칸(오늘)이 비어 있는 것은 아직 끊긴 게 아니다
    if (i === cells.length - 1) continue;
    break;
  }

  return run;
}

/** 한글 날짜 라벨 — 칸에 손을 올렸을 때 뜬다 */
export function heatLabel(cell: PublishDay): string {
  const [, month, day] = cell.date.split("-");
  const when = `${Number(month)}월 ${Number(day)}일`;

  return cell.count > 0 ? `${when} · ${cell.count}장` : `${when} · 쉼`;
}

/** 격자의 한 열 = 한 주. 7행짜리 격자이므로 칸 7개가 한 열이다 */
export const HEATMAP_COLUMN = 7;

export type MonthSpan = {
  /** `YYYY-MM` */
  key: string;
  /** 격자 아래에 적을 글자. 좁은 구간에서는 비운다 */
  label: string;
  /** 이 달이 차지하는 열(주) 수 */
  weeks: number;
};

/**
 * 격자 아래 월 표시 (H-01 기록 장면).
 *
 * **어디서 시작하는지 모르면 격자는 무늬일 뿐이다.** 달이 바뀌는 열을 찾아 그 아래에 적는다.
 *
 * 열의 날짜는 그 열 **첫 칸**을 따른다 — 한 열에 두 달이 걸치면 앞선 달로 센다.
 * 두 주가 안 되는 구간은 글자가 옆 달과 겹치므로 비운다.
 */
export function monthSpans(cells: PublishDay[]): MonthSpan[] {
  const spans: MonthSpan[] = [];

  for (let start = 0; start < cells.length; start += HEATMAP_COLUMN) {
    const key = cells[start].date.slice(0, 7);
    const previous = spans.at(-1);

    if (previous?.key === key) {
      previous.weeks += 1;
      continue;
    }

    const month = Number(key.slice(5, 7));
    spans.push({
      key,
      // 해가 바뀌는 자리에만 연도를 적는다 — 매달 적으면 읽을 것이 늘기만 한다
      label: month === 1 ? `${key.slice(2, 4)}년 1월` : `${month}월`,
      weeks: 1,
    });
  }

  // 글자가 들어갈 자리가 없는 구간은 비운다. 칸은 그대로 두어 폭이 어긋나지 않게 한다
  for (const span of spans) {
    if (span.weeks < 2) span.label = "";
  }

  return spans;
}
