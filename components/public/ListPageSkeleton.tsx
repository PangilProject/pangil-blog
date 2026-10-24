import { SiteHeader } from "@/components/public/SiteHeader";
import { LoadingRegion, SkeletonBlock, SkeletonFrame } from "@/components/record/Skeleton";
import type { PublicSite } from "@/lib/revalidate/tags";

/**
 * 목록 지면이 오는 동안 (`(list)/loading.tsx`). 모양은 ListPageView를 따른다 — 헤더 줄, 제목과 카운트,
 * 검색 밑줄, 카드 격자. 격자 규칙(250px 최소 칸)이 같아야 카드가 들어올 때 칸 수가 안 바뀐다.
 *
 * 제목은 막대다. 분류·검색어·태그가 정하는데 이 틀은 그것을 모른다.
 *
 * 사이드바와 푸터는 레이아웃의 것이라 이 틀이 서는 동안에도 그대로 있다.
 */
export function ListPageSkeleton({ site }: { site: PublicSite }) {
  return (
    <main className="flex w-full flex-col gap-6">
      <SiteHeader site={site} />

      <LoadingRegion className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          {/* 줄 높이는 진짜 제목(ListHeader h1)의 글꼴이 정한다 — 폭에 따라 19~23px로 변하므로 막대
              높이를 숫자로 박으면 어느 한 폭에서는 반드시 어긋난다. 폭 없는 공백이 그 줄을 세운다 */}
          <div className="flex flex-wrap items-center justify-between gap-3 font-serif text-[clamp(19px,3vw,23px)]">
            <span className="flex items-center">
              <SkeletonBlock className="h-[1.1em] w-40" />
              {"\u200b"}
            </span>
            <SkeletonBlock className="h-3 w-36" />
          </div>
          <SkeletonFrame className="h-[35px] border-edge border-b" />
        </div>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-5">
          {Array.from({ length: 6 }, (_, index) => (
            <SkeletonFrame
              // biome-ignore lint/suspicious/noArrayIndexKey: 자리 표시라 순서 말고는 구분할 것이 없다
              key={index}
              className="flex h-[190px] flex-col gap-3 border border-edge bg-card p-5"
            >
              <SkeletonBlock className="h-2.5 w-24" />
              <SkeletonBlock className="h-4 w-4/5" />
              <SkeletonBlock className="h-3 w-3/5" />
              <SkeletonBlock className="mt-auto h-2.5 w-16" />
            </SkeletonFrame>
          ))}
        </div>
      </LoadingRegion>
    </main>
  );
}
