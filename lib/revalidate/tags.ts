import type { RecordType } from "@/lib/record/callNumber";

/**
 * 캐시 무효화 태그 체계 (04 §1.2 · 05 §5에서 정밀화).
 *
 * 시간 기반 ISR을 쓰지 않는다. 1인 블로그의 콘텐츠 변경은 100% 작성자 행동에서 오므로
 * 이벤트 기반 무효화가 정확하고 무료 티어에도 최적이다.
 *
 * 태그는 site 스코프다 — dev/faith에 동명 태그가 공존할 수 있어(tags 테이블
 * `@@unique([site, name])`), 스코프가 없으면 한쪽 발행이 다른 사이트 캐시를 날린다.
 */

/** 글이 속한 사이트. type의 함수라 컬럼으로 두지 않는다(05 §1.4) */
export type PublicSite = "dev" | "faith";

export function siteOf(type: RecordType): PublicSite {
  return type === "TECH" ? "dev" : "faith";
}

export const postTag = (id: string) => `post:${id}`;
export const listTag = (site: PublicSite) => `list:${site}`;
/** 타입별(faith) 또는 카테고리별(dev) 목록 */
export const listFacetTag = (site: PublicSite, facet: string) => `list:${site}:${facet}`;
export const tagTag = (site: PublicSite, name: string) => `tag:${site}:${name}`;
export const feedTag = (site: PublicSite) => `feed:${site}`;

export type PostRevalidationInput = {
  id: string;
  type: RecordType;
  /** TECH의 카테고리 slug */
  categorySlug?: string | null;
  tagNames?: string[];
};

/**
 * 발행·수정·삭제·PRIVATE 전환이 한 번에 무효화해야 하는 태그 전체 (04 §1.2).
 * 빠뜨리면 "발행 즉시 반영"이 깨지고, 그건 작성자가 가장 먼저 알아채는 고장이다.
 */
export function postRevalidationTags({
  id,
  type,
  categorySlug,
  tagNames = [],
}: PostRevalidationInput): string[] {
  const site = siteOf(type);

  const tags = [
    postTag(id),
    listTag(site),
    // faith는 타입 필터(F-02), dev는 카테고리 목록(D-03)이 각자의 facet이다
    listFacetTag(site, type === "TECH" ? (categorySlug ?? "uncategorized") : type),
    feedTag(site),
    ...tagNames.map((name) => tagTag(site, name)),
  ];

  return [...new Set(tags)];
}
