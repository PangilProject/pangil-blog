import { ListHeader } from "@/components/public/ListHeader";
import { PostList } from "@/components/public/PostList";
import { SiteHeader } from "@/components/public/SiteHeader";
import { Pagination } from "@/components/record/Pagination";
import type { ListPage, RecordCounts } from "@/lib/db/publicLists";
import type { PublicSite } from "@/lib/revalidate/tags";

/**
 * 목록 지면 껍데기 (F-01/F-02/F-04 · D-01/D-03 · 03 §5.1).
 *
 * 네 갈래 목록(홈·타입별·태그별·검색)이 같은 껍데기를 쓴다. 다른 것은 제목·조건뿐이고
 * 헤더 카운트, 카드 그리드, 페이지네이션, 검색창은 같다 — 네 벌로 두면 그중 하나만 낡는다.
 *
 * 폭과 바깥 여백은 여기서 정하지 않는다. 사이드바와 나란히 서므로 그 2단 구성이 레이아웃의
 * 몫이 됐다 — 목록이 자기 폭을 다시 정하면 사이드바 옆에서 두 번 좁아진다.
 *
 * 분류 칸막이 탭도 빠졌다. 같은 분류 링크가 목록 위와 사이드바에 두 벌 서게 되고, 그중 한
 * 벌에만 글 수가 붙는다(SiteSidebar).
 */
export function ListPageView({
  site,
  title,
  month,
  counts,
  page,
  hrefFor,
  searchAction,
  searchQuery,
  emptyMessage,
}: {
  site: PublicSite;
  title: string;
  month: string;
  counts: RecordCounts;
  page: ListPage;
  hrefFor: (page: number) => string;
  searchAction: string;
  searchQuery?: string;
  emptyMessage?: string;
}) {
  return (
    <main className="flex w-full flex-col gap-6">
      <SiteHeader site={site} />

      <ListHeader
        title={title}
        month={month}
        counts={counts}
        searchAction={searchAction}
        searchQuery={searchQuery}
      />

      <PostList cards={page.cards} emptyMessage={emptyMessage} />

      <Pagination page={page.page} pageCount={page.pageCount} hrefFor={hrefFor} />
    </main>
  );
}
