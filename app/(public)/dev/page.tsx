import { connection } from "next/server";

import { ListPageView } from "@/components/public/ListPageView";
import { countPublishedPosts, findPublishedPosts, findUsedCategories } from "@/lib/db/publicLists";
import { startOfKstMonth, toKstDate } from "@/lib/record/kst";

/**
 * D-01 기술 블로그 홈 = 글 목록 (02 §2.2).
 *
 * 홈과 목록을 통합한다(02 §2.2 — 기술 글은 비정기라 별도 홈 큐레이션은 과설계).
 * 카테고리 필터(D-03)는 쿼리 파라미터, 태그는 경로다 — faith와 같은 규칙이다.
 *
 * 카테고리 탭은 **글이 있는 카테고리만** 보여준다. 빈 칸막이는 "이 칸은 아직 비어 있어요"를
 * 부르는 자리만 만든다.
 */
export const instant = false;

export default async function DevHomePage({ searchParams }: PageProps<"/dev">) {
  // 시계를 읽기 전에 요청을 확보한다. `new Date()`는 프리렌더에서 거부된다 —
  // 재현 가능한 출력만 허용하기 때문이다(ADR-003). 실제로 이 페이지가 그렇게 깨졌다
  await connection();

  const params = await searchParams;
  const categorySlug = typeof params.category === "string" ? params.category : null;
  const query = typeof params.q === "string" ? params.q : undefined;
  const page = Number(typeof params.page === "string" ? params.page : 1) || 1;
  const now = new Date();

  const [list, counts, categories] = await Promise.all([
    findPublishedPosts({ site: "dev", categorySlug, query, page }),
    countPublishedPosts("dev", startOfKstMonth(now)),
    findUsedCategories(),
  ]);

  const search = new URLSearchParams();
  if (categorySlug) search.set("category", categorySlug);
  if (query) search.set("q", query);

  const hrefFor = (target: number) => {
    const next = new URLSearchParams(search);
    if (target > 1) next.set("page", String(target));
    const suffix = next.toString();
    return suffix ? `/dev?${suffix}` : "/dev";
  };

  return (
    <ListPageView
      title={query ? `"${query}" 검색 결과` : "개발의 기록"}
      month={`${toKstDate(now).month}월`}
      counts={counts}
      tabs={[
        { label: "전체", href: "/dev", active: categorySlug === null },
        ...categories.map((category) => ({
          label: category.name,
          href: `/dev?category=${category.slug}`,
          active: categorySlug === category.slug,
        })),
      ]}
      tabsLabel="카테고리 필터"
      page={list}
      hrefFor={hrefFor}
      searchAction="/dev"
      searchQuery={query}
      emptyMessage={query ? "찾는 글이 없어요" : "이 칸은 아직 비어 있어요"}
    />
  );
}
