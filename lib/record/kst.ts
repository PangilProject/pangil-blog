/**
 * KST 날짜 계산 (06 §2 — "Actions는 UTC → KST(UTC+9, DST 없음) 변환").
 *
 * 이 블로그의 "오늘"은 항상 KST다. 서버는 UTC로 돌고(Vercel·GitHub Actions) 크롤러의 멱등
 * 키도 KST 날짜이므로(CrawlRun.runDate), 날짜를 다루는 규칙은 한 곳에만 둔다.
 *
 * KST는 서머타임이 없어 UTC+9 고정이다 — 그래서 오프셋 상수 하나로 충분하고,
 * Intl 타임존 변환보다 이 편이 테스트하기 쉽다.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 0=일요일 … 6=토요일 */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type KstDate = {
  year: number;
  /** 1~12 */
  month: number;
  day: number;
  weekday: Weekday;
};

/** KST 벽시계로 본 날짜 */
export function toKstDate(now: Date): KstDate {
  const shifted = new Date(now.getTime() + KST_OFFSET_MS);

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay() as Weekday,
  };
}

/** "2026-08-23" — CrawlRun.runDate(@db.Date)와 맞추는 키 */
export function kstDateKey(now: Date): string {
  const { year, month, day } = toKstDate(now);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** KST 오늘 0시의 실제 시각(UTC). "오늘 만든 기록"을 고르는 경계다 */
export function startOfKstDay(now: Date): Date {
  const shifted = now.getTime() + KST_OFFSET_MS;
  return new Date(Math.floor(shifted / DAY_MS) * DAY_MS - KST_OFFSET_MS);
}

/** KST 이번 달 1일 0시의 실제 시각(UTC). "이번 달 N장"의 경계다(03 §5.1) */
export function startOfKstMonth(now: Date): Date {
  const { year, month } = toKstDate(now);
  const label = `${year}-${String(month).padStart(2, "0")}-01T00:00:00.000Z`;
  return new Date(new Date(label).getTime() - KST_OFFSET_MS);
}

/** CrawlRun.runDate 비교용 — KST 날짜의 자정을 UTC 자정으로 적은 값(@db.Date 관례) */
export function kstDateAsUtcMidnight(now: Date): Date {
  return new Date(`${kstDateKey(now)}T00:00:00.000Z`);
}

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** "8월 23일 일요일" (03 프로토타입 헤더 표기) */
export function formatKstDay(now: Date): string {
  const { month, day, weekday } = toKstDate(now);
  return `${month}월 ${day}일 ${WEEKDAY_LABELS[weekday]}요일`;
}

/** 일요일인가 — 설교 카드가 서는 날 (02 §3.1) */
export function isSunday(now: Date): boolean {
  return toKstDate(now).weekday === 0;
}

/** "2026-08-24" → 그 KST 날짜의 @db.Date 값. 크롤러가 보내온 runDate를 키로 쓸 때 */
export function kstDateKeyAsUtcMidnight(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}
