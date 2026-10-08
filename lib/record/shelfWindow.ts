/** 지금 글을 빼고 창에 서는 줄 수 — 앞뒤 둘씩 (findShelf) */
export const SHELF_OTHERS = 4;

/**
 * 창에 앞뒤를 몇 줄씩 세울지. 기본은 둘·둘이고, 한쪽이 모자라면 다른 쪽에서 채운다.
 *
 * 조회(`findShelf`)에서 떼어 둔 이유는 테스트다 — 축의 끝(첫 글·마지막 글)에서만 갈리는
 * 셈이라 화면으로는 잘 안 보인다.
 */
export function pickWindow(
  olderCount: number,
  newerCount: number,
): { older: number; newer: number } {
  const half = SHELF_OTHERS / 2;
  const newer = Math.min(newerCount, Math.max(half, SHELF_OTHERS - olderCount));
  const older = Math.min(olderCount, SHELF_OTHERS - newer);
  return { older, newer };
}
