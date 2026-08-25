/**
 * 유입 경로 정규화 (05 §4).
 *
 * `referrer`는 클라이언트가 보낸 값이라 **URL이 아닐 수도 있다.** 그래서 이 함수는 던지지
 * 않고, 파싱 실패를 "알 수 없음"이라는 하나의 칸으로 모은다 — 조작된 값 하나가 목록에
 * 자기 줄을 갖게 하면 그게 곧 남의 광고판이 된다.
 *
 * 호스트만 남기는 이유는 같은 검색엔진이 쿼리스트링 때문에 열 줄로 갈라지는 것을 막기
 * 위해서다. 어디서 왔는지는 호스트로 충분하고, 검색어는 어차피 대부분 넘어오지 않는다.
 */

export const DIRECT = "직접 방문";
export const UNKNOWN = "알 수 없음";

export function referrerHost(referrer: string | null | undefined): string {
  if (!referrer) return DIRECT;

  try {
    const { host, protocol } = new URL(referrer);
    // http(s)가 아닌 스킴(javascript:, data: …)은 유입 경로가 아니다
    if (protocol !== "http:" && protocol !== "https:") return UNKNOWN;
    return host || DIRECT;
  } catch {
    return UNKNOWN;
  }
}

/**
 * 검색 유입과 사이트 유입을 가른다 (티스토리 통계의 갈림을 그대로 따른다).
 *
 * 이 구별이 필요한 이유는 **둘이 다른 행동을 부르기** 때문이다. 검색 유입이 늘면 그 주제를
 * 더 쓰라는 뜻이고(00 §6.3), 사이트 유입이 늘면 어디서 링크됐는지 찾아볼 일이다.
 *
 * 호스트 조각으로 판단한다. 검색엔진 목록을 완벽하게 유지할 생각은 없다 — 놓친 엔진이
 * "사이트"로 잡히는 것은 큰 손해가 아니고, 그 목록을 관리하는 비용이 더 크다.
 */
const SEARCH_HOSTS = [
  "google.",
  "naver.",
  "daum.",
  "bing.",
  "duckduckgo.",
  "yandex.",
  "baidu.",
  "zum.",
  "search.",
];

export type ReferrerKind = "search" | "site" | "direct" | "unknown";

export function referrerKind(host: string): ReferrerKind {
  if (host === DIRECT) return "direct";
  if (host === UNKNOWN) return "unknown";
  return SEARCH_HOSTS.some((needle) => host.includes(needle)) ? "search" : "site";
}

export const REFERRER_KIND_LABELS: Record<ReferrerKind, string> = {
  search: "검색",
  site: "사이트",
  direct: "직접",
  unknown: "알 수 없음",
};
