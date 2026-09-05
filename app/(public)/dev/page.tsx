import { connection } from "next/server";

import { JsonLd } from "@/components/public/JsonLd";
import { ListPageView } from "@/components/public/ListPageView";
import { countPublishedPosts, findPublishedPosts } from "@/lib/db/publicLists";
import { startOfKstMonth, toKstDate } from "@/lib/record/kst";
import { blogJsonLd } from "@/lib/seo/jsonLd";
import { siteAlternates } from "@/lib/site/metadata";

/**
 * D-01 기술 블로그 홈 = 글 목록 (02 §2.2).
 *
 * 홈과 목록을 통합한다(02 §2.2 — 기술 글은 비정기라 별도 홈 큐레이션은 과설계).
 * 카테고리 필터(D-03)는 쿼리 파라미터, 태그는 경로다 — faith와 같은 규칙이다.
 *
 * 카테고리 축은 사이드바가 쥔다(SiteSidebar) — 목록 위 칸막이 탭과 두 벌이 되지 않게.
 * 거기서도 **글이 있는 카테고리만** 보여준다: 빈 칸막이는 "이 칸은 아직 비어 있어요"를
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

  const [list, counts] = await Promise.all([
    findPublishedPosts({ site: "dev", categorySlug, query, page }),
    countPublishedPosts("dev", startOfKstMonth(now)),
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
    <>
      <JsonLd data={blogJsonLd("dev", "/dev")} />

      <ListPageView
        site="dev"
        title={query ? `"${query}" 검색 결과` : "개발의 기록"}
        month={`${toKstDate(now).month}월`}
        counts={counts}
        titleHidden={!query}
        page={list}
        hrefFor={hrefFor}
        searchAction="/dev"
        searchQuery={query}
        emptyMessage={query ? "찾는 글이 없어요" : "이 칸은 아직 비어 있어요"}
      />
    </>
  );
}

/**
 * 검색 결과는 색인 대상이 아니다 — 같은 글이 질의마다 다른 주소로 또 걸린다. 카테고리와
 * 페이지는 각자 다른 목록이므로 자기 주소를 정규 주소로 삼는다.
 */
export async function generateMetadata({ searchParams }: PageProps<"/dev">) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : undefined;

  if (query) return { title: `"${query}" 검색 결과`, robots: { index: false, follow: true } };

  const facets = new URLSearchParams();
  if (typeof params.category === "string") facets.set("category", params.category);
  if (typeof params.page === "string" && params.page !== "1") facets.set("page", params.page);

  const suffix = facets.toString();
  return { alternates: siteAlternates("dev", suffix ? `/dev?${suffix}` : "/dev") };
}
