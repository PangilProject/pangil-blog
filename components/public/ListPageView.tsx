import { ListHeader } from "@/components/public/ListHeader";
import { PostList } from "@/components/public/PostList";
import { SiteHeader } from "@/components/public/SiteHeader";
import { type DividerTabItem, DividerTabs } from "@/components/record/DividerTabs";
import { Pagination } from "@/components/record/Pagination";
import type { ListPage, RecordCounts } from "@/lib/db/publicLists";
import type { PublicSite } from "@/lib/revalidate/tags";

/**
 * 목록 지면 껍데기 (F-01/F-02/F-04 · D-01/D-03 · 03 §5.1).
 *
 * 네 갈래 목록(홈·타입별·태그별·검색)이 같은 껍데기를 쓴다. 다른 것은 제목·탭·조건뿐이고
 * 헤더 카운트, 카드 그리드, 페이지네이션, 검색창은 같다 — 네 벌로 두면 그중 하나만 낡는다.
 */
export function ListPageView({
  site,
  title,
  month,
  counts,
  tabs,
  tabsLabel,
  page,
  hrefFor,
  searchAction,
  searchQuery,
  emptyMessage,
  titleHidden,
}: {
  site: PublicSite;
  title: string;
  month: string;
  counts: RecordCounts;
  tabs?: DividerTabItem[];
  tabsLabel?: string;
  page: ListPage;
  hrefFor: (page: number) => string;
  searchAction: string;
  searchQuery?: string;
  emptyMessage?: string;
  /** 헤더가 이미 지면 이름을 말하는 자리에서 제목을 감춘다 */
  titleHidden?: boolean;
}) {
  return (
    <main className="mx-auto flex w-full max-w-[1080px] flex-col gap-6 px-[5%] py-10">
      <SiteHeader site={site} />

      <ListHeader
        title={title}
        month={month}
        counts={counts}
        searchAction={searchAction}
        searchQuery={searchQuery}
        titleHidden={titleHidden}
      />

      {tabs && tabs.length > 0 && <DividerTabs items={tabs} label={tabsLabel ?? "필터"} />}

      <PostList cards={page.cards} emptyMessage={emptyMessage} />

      <Pagination page={page.page} pageCount={page.pageCount} hrefFor={hrefFor} />
    </main>
  );
}
