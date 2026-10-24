import { SiteHeader } from "@/components/public/SiteHeader";
import { LoadingRegion, SkeletonBlock, SkeletonFrame } from "@/components/record/Skeleton";
import type { PublicSite } from "@/lib/revalidate/tags";

/**
 * 상세 지면이 오는 동안 (`[slug]/loading.tsx`). 모양은 RecordSheet를 따른다 — 상단 괘, 청구기호 줄,
 * 제목, 본문 문단. 괘 색은 레이아웃의 `data-site`가 이미 정해 두어 여기서도 그 지면의 색이다.
 *
 * **dev는 목차 칸 자리를 비워 둔다.** 데스크탑의 dev 상세는 본문 + 목차(13rem) 두 칸이고 본문
 * 칸이 그 통 안에서 가운데 선다. 목차 칸 없이 시트만 세우면 내용이 들어오는 순간 시트가
 * 7.5rem 옆으로 미끄러진다. 헤더의 목차 손잡이(`foldsToc`)도 같은 이유로 미리 세운다 — 그 줄은
 * 오른쪽 정렬이라 손잡이 하나가 늦게 끼면 `글쓰기`와 밝기 토글이 왼쪽으로 밀린다.
 */
export function PostPageSkeleton({ site }: { site: PublicSite }) {
  const sheet = <PostSheetSkeleton />;

  if (site === "faith") {
    return (
      <main className="flex w-full flex-col gap-8">
        <SiteHeader site="faith" />
        {sheet}
      </main>
    );
  }

  return (
    <main className="group/page flex w-full flex-col gap-8">
      <SiteHeader site="dev" foldsToc />

      <div className="mx-auto flex w-full max-w-[calc(var(--container-sheet)+15rem)] flex-col lg:flex-row lg:items-start lg:gap-10">
        <div className="flex min-w-0 flex-1 flex-col gap-8">{sheet}</div>
        <div aria-hidden className="max-lg:hidden lg:w-[13rem] lg:flex-none" />
      </div>
    </main>
  );
}

function PostSheetSkeleton() {
  return (
    <LoadingRegion>
      <SkeletonFrame className="relative mx-auto w-full max-w-sheet border border-edge bg-card px-[7%] pt-9 pb-14 shadow-card">
        <div className="absolute inset-x-0 top-0 h-[1.5px] bg-(--accent)" />

        <div className="flex flex-col gap-3">
          <SkeletonBlock className="h-3 w-40" />
          <SkeletonBlock className="h-7 w-3/4" />
        </div>

        <div className="mt-7 flex flex-col gap-3">
          <SkeletonBlock className="h-3.5 w-full" />
          <SkeletonBlock className="h-3.5 w-full" />
          <SkeletonBlock className="h-3.5 w-11/12" />
          <SkeletonBlock className="h-3.5 w-full" />
          <SkeletonBlock className="h-3.5 w-2/3" />
        </div>
      </SkeletonFrame>
    </LoadingRegion>
  );
}
