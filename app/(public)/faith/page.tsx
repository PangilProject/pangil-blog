import { connection } from "next/server";

import { JsonLd } from "@/components/public/JsonLd";
import { ListPageView } from "@/components/public/ListPageView";
import { countPublishedPosts, findPublishedPosts } from "@/lib/db/publicLists";
import { FAITH_TYPES, TYPE_LABELS } from "@/lib/record/axis";
import type { RecordType } from "@/lib/record/callNumber";
import { startOfKstMonth, toKstDate } from "@/lib/record/kst";
import { blogJsonLd } from "@/lib/seo/jsonLd";
import { siteAlternates } from "@/lib/site/metadata";

/**
 * F-01 묵상 블로그 홈 = 통합 목록 (02 §2.3).
 *
 * 정렬은 **순수 최신순**이다(2026-08-18 결정). QT를 저녁에 쓰는 날도 있어 작성 순서가
 * 유동적이므로 상단 고정·그룹핑을 두지 않는다.
 *
 * 타입 축은 사이드바가 쥔다(SiteSidebar) — 목록 위 칸막이 탭과 두 벌이 되지 않게.
 *
 * 타입 필터(F-02)는 쿼리 파라미터다 — URL로 공유 가능한 뷰이고, `/faith/{slug}`가 상세이므로
 * 경로 세그먼트를 쓸 수 없다. 태그별 목록(F-04)만 경로다(`/faith/tags/{태그}`) — 상세에서
 * 오는 링크이고 검색엔진이 읽는 주소다.
 *
 * 검색어·필터·페이지를 읽으므로 이 지면은 요청마다 렌더된다. 대신 **조회 함수가 캐시된다**
 * (ADR-003) — 같은 조건이면 DB를 다시 훑지 않는다.
 */
export const instant = false;

// 축 정의는 lib/record/axis 하나다 — 목록·상세·글 관리가 같은 것을 본다
const TYPE_TABS: { label: string; type: RecordType | null }[] = [
  { label: "전체", type: null },
  ...FAITH_TYPES.map((type) => ({ label: TYPE_LABELS[type], type })),
];

function parseType(value: string | undefined): RecordType | null {
  return TYPE_TABS.find((tab) => tab.type === value)?.type ?? null;
}

/**
 * 목록 제목. 지면 이름이 아니라 **지금 보고 있는 목록**의 이름이다 — 지면 이름은 사이드바가
 * 말한다(SiteSidebar). 같은 말이 한 화면에 두 번 찍히면 그중 하나는 장식이다.
 */
function listTitle(query: string | undefined, type: RecordType | null): string {
  if (query) return `"${query}" 검색 결과`;
  return type ? TYPE_LABELS[type] : "전체 글";
}

export default async function FaithHomePage({ searchParams }: PageProps<"/faith">) {
  // 시계를 읽기 전에 요청을 확보한다. `new Date()`는 프리렌더에서 거부된다 —
  // 재현 가능한 출력만 허용하기 때문이다(ADR-003). 실제로 이 페이지가 그렇게 깨졌다
  await connection();

  const params = await searchParams;
  const type = parseType(typeof params.type === "string" ? params.type : undefined);
  const query = typeof params.q === "string" ? params.q : undefined;
  const page = Number(typeof params.page === "string" ? params.page : 1) || 1;
  const now = new Date();

  const [list, counts] = await Promise.all([
    findPublishedPosts({ site: "faith", type, query, page }),
    countPublishedPosts("faith", startOfKstMonth(now)),
  ]);

  const search = new URLSearchParams();
  if (type) search.set("type", type);
  if (query) search.set("q", query);

  const hrefFor = (target: number) => {
    const next = new URLSearchParams(search);
    if (target > 1) next.set("page", String(target));
    const suffix = next.toString();
    return suffix ? `/faith?${suffix}` : "/faith";
  };

  return (
    <>
      <JsonLd data={blogJsonLd("faith", "/faith")} />

      <ListPageView
        site="faith"
        title={listTitle(query, type)}
        month={`${toKstDate(now).month}월`}
        counts={counts}
        page={list}
        hrefFor={hrefFor}
        searchAction="/faith"
        searchQuery={query}
        // 03 §7.2 — `기록`은 브랜드어(지면 이름·반갑)고, 셀 수 있는 대상은 `글`이다
        emptyMessage={query ? "찾는 글이 없어요" : "이 칸은 아직 비어 있어요"}
      />
    </>
  );
}

/** dev 목록과 같은 규칙 — 검색은 색인하지 않고, 타입 필터·페이지는 자기 주소를 쓴다 */
export async function generateMetadata({ searchParams }: PageProps<"/faith">) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : undefined;

  if (query) return { title: `"${query}" 검색 결과`, robots: { index: false, follow: true } };

  const type = parseType(typeof params.type === "string" ? params.type : undefined);
  const facets = new URLSearchParams();
  if (type) facets.set("type", type);
  if (typeof params.page === "string" && params.page !== "1") facets.set("page", params.page);

  const label = TYPE_TABS.find((tab) => tab.type === type)?.label;
  const suffix = facets.toString();

  return {
    ...(type && label ? { title: label } : {}),
    alternates: siteAlternates("faith", suffix ? `/faith?${suffix}` : "/faith"),
  };
}
