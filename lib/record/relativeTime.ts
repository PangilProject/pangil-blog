/**
 * 상대 시각 표기 (03 §6.2 저장 인디케이터·A-01 카드).
 *
 * 관리 화면에서만 쓴다. 공개 지면의 날짜는 절대 표기다(기록물의 날짜는 바뀌면 안 된다).
 * 서버에서 렌더하므로 순수 함수로 두고 기준 시각을 주입받는다.
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatRelativeTime(at: Date, now: Date): string {
  const elapsed = now.getTime() - at.getTime();

  // 시계가 어긋난 경우(미래)도 "방금"으로 흡수한다 — 관리 화면에서 음수 시간을 보일 이유가 없다
  if (elapsed < MINUTE) return "방금";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}분 전`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}시간 전`;

  const days = Math.floor(elapsed / DAY);
  return days === 1 ? "어제" : `${days}일 전`;
}
