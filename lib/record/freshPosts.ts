/**
 * 목록에서 "새 글"로 표시할 것 (02 §2.2).
 *
 * **오늘·어제를 시각으로 재지 않는다.** 공개 목록은 통째로 캐시되고(ADR-003) 그 캐시는
 * *글이 발행될 때* 무효화된다 — 시간이 흘러서가 아니다. 그래서 렌더 중에 "오늘"을 읽으면
 * 어제 만든 HTML이 오늘도 "오늘"이라고 적혀 있게 된다. 사이드바 조회 수에서 겪은 것과
 * 같은 함정이다.
 *
 * 대신 **목록 안에서 가장 최근 발행일**을 기준으로 삼는다. 데이터에서만 나오는 값이라
 * 캐시와 어긋날 수 없고, 새 글이 발행되면 캐시가 갈리면서 표시도 따라 옮겨간다.
 *
 * 날마다 쓰는 블로그에서 이 값은 사실상 "오늘 올린 것"이다. 며칠 쉬면 그 며칠 전 글이
 * 계속 새 글로 남는데, 그건 **목록에서 가장 새것이 맞다**.
 */

/** 한국 시간 기준 날짜 열쇠. 발행 시각은 UTC로 저장된다(05 §1.4) */
function dateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(date);
}

/**
 * 가장 최근 발행일에 올라온 글의 id.
 *
 * 하나뿐이면 표시하지 않는다 — 목록에 늘 별 하나가 떠 있으면 그건 표시가 아니라 장식이다.
 * 같은 날 올린 글이 여럿일 때 그 묶음이 "이번에 올라온 것"으로 읽힌다.
 */
export function freshPostIds(posts: { id: string; publishedAt: Date | null }[]): Set<string> {
  const dated = posts.filter(
    (post): post is { id: string; publishedAt: Date } => post.publishedAt !== null,
  );
  if (dated.length === 0) return new Set();

  const newest = dated.reduce((latest, post) =>
    post.publishedAt > latest.publishedAt ? post : latest,
  );
  const key = dateKey(newest.publishedAt);

  return new Set(dated.filter((post) => dateKey(post.publishedAt) === key).map((post) => post.id));
}
