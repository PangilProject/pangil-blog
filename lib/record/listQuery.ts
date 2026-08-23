import type { RecordType } from "@/lib/record/callNumber";
import { listFacetTag, listTag, type PublicSite, tagTag } from "@/lib/revalidate/tags";
import { PostStatus, type PostType } from "@/prisma/generated/enums";

/**
 * 공개 목록의 조회 조건 (02 §2.2·§2.3 · 04 §1.2).
 *
 * 리포지토리(lib/db/publicLists)가 아니라 여기 있는 이유는 **테스트가 직접 봐야 하기**
 * 때문이다. 캐시 함수는 Next 런타임 밖에서 돌 수 없고, 리포지토리를 import하면 Prisma까지
 * 딸려온다. 조건은 DB에 닿지 않는 순수 규칙이므로 밖에 둔다.
 */

export type ListQuery = {
  site: PublicSite;
  /** faith 타입 필터 (F-02) */
  type?: RecordType | null;
  /** dev 카테고리 필터 (D-03) */
  categorySlug?: string | null;
  /** 태그 필터 (F-04 / D-03) */
  tag?: string | null;
  /** 검색어 (D-04 / F-05) */
  query?: string | null;
  page?: number;
};

export const PAGE_SIZE = 12;

export const TYPES_BY_SITE: Record<PublicSite, PostType[]> = {
  dev: ["TECH"],
  faith: ["QT", "SERMON", "PRAISE"],
};

/**
 * 조회 조건. **PUBLISHED 강제와 지면 스코프가 이 함수에만 있다** — 목록 다섯 갈래가 같은
 * 조건을 쓰므로, 여기만 맞으면 어느 갈래에서도 PRIVATE·DRAFT가 새지 않는다.
 * 테스트가 이 함수를 직접 본다(캐시 함수는 Next 런타임 밖에서 돌 수 없다).
 */
export function listWhere(query: ListQuery) {
  const search = query.query?.trim();

  return {
    status: PostStatus.PUBLISHED,
    type: query.type ? (query.type as PostType) : { in: TYPES_BY_SITE[query.site] },
    ...(query.categorySlug ? { category: { slug: query.categorySlug } } : {}),
    ...(query.tag ? { tags: { some: { tag: { name: query.tag } } } } : {}),
    // pg_trgm GIN 인덱스가 이 ILIKE를 받는다(05 §4A). searchText는 발행 시 채워진 평문이다
    ...(search ? { searchText: { contains: search, mode: "insensitive" as const } } : {}),
  };
}

export function listCacheTags(query: ListQuery): string[] {
  const tags = [listTag(query.site)];

  // 목록의 부분집합 뷰는 자기 태그로도 무효화된다(04 §1.2)
  if (query.type) tags.push(listFacetTag(query.site, query.type));
  if (query.categorySlug) tags.push(listFacetTag(query.site, query.categorySlug));
  if (query.tag) tags.push(tagTag(query.site, query.tag));

  return tags;
}
