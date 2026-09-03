/**
 * 페이지 번호 창 (02 §2.2·§2.3 목록 페이지네이션).
 *
 * 기술 지면은 514편이라 43페이지다 — "이전·다음"만으로는 20페이지 뒤로 가는 데 스무 번을
 * 눌러야 한다. 그래서 번호를 놓는데, 43개를 다 놓으면 그게 목록보다 길어진다. 창을 고정 폭으로
 * 두고 현재 페이지를 그 안에서 움직인다.
 *
 * 창은 **끝에서도 폭을 유지한다.** 마지막 페이지에서 번호가 하나만 남으면 옆으로 갈 곳이
 * 없어 보인다 — 실제로는 앞쪽으로 갈 수 있는데도.
 */

/** 한 번에 놓는 번호 개수 */
export const PAGE_WINDOW = 5;

export function pageWindow(page: number, pageCount: number, size = PAGE_WINDOW): number[] {
  if (pageCount < 1) return [];

  // 범위 밖 페이지는 URL로 직접 들어온 값이다. 빈 창을 주지 않고 가장 가까운 자리로 붙인다
  const current = Math.min(Math.max(Math.trunc(page) || 1, 1), pageCount);
  const width = Math.min(size, pageCount);

  const half = Math.floor(width / 2);
  const start = Math.min(Math.max(current - half, 1), pageCount - width + 1);

  return Array.from({ length: width }, (_, index) => start + index);
}
