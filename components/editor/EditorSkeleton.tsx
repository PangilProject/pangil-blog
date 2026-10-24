import { ThemeToggle } from "@/components/public/ThemeToggle";
import { LoadingRegion, SkeletonBlock, SkeletonFrame } from "@/components/record/Skeleton";

/**
 * 에디터가 오는 동안의 틀 (`app/admin/write/loading.tsx` · `app/admin/edit/loading.tsx`).
 *
 * 모양은 EditorShell을 따른다: 위에 붙는 띠(밝기 · 저장 상태 / 버튼들) + 툴바, 그 아래 720px 시트.
 * 에디터가 들어올 때 띠와 시트가 제자리에 서야 한다 — 크게 어긋나면 그게 곧 흔들림이다.
 *
 * **지면 색(`data-site`)을 입지 않는다.** 어느 에디터인지는 경로가 정하는데 이 틀은 경로를 모른다
 * (write/ 한 곳의 loading이 네 에디터를 다 받는다). 그래서 시트 상단 괘도 긋지 않는다 — 빨간 괘가
 * 섰다가 기술 글에서 파랗게 바뀌면 그 한 번의 색 바뀜이 눈에 걸린다.
 *
 * **포커스를 가져가지 않는다**(방해 요소 제로 · 프리모템 #2). 눌러지는 것은 밝기 토글 하나뿐이다.
 */
export function EditorSkeleton() {
  return (
    <div className="flex flex-1 flex-col bg-paper">
      <div className="sticky top-0 z-20">
        <div className="flex flex-wrap items-center justify-between gap-3 border-edge border-b bg-paper px-[5%] py-[11px]">
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <SkeletonBlock className="h-3 w-24" />
          </div>
          <div className="flex items-center gap-2.5">
            <SkeletonBlock className="h-8 w-16" />
            <SkeletonBlock className="h-8 w-16" />
          </div>
        </div>
        <div className="border-edge border-b bg-surface-tab px-[5%] py-[9px]">
          <SkeletonBlock className="h-9 w-full max-w-md" />
        </div>
      </div>

      <LoadingRegion className="mx-auto mt-[26px] mb-[50px] w-full max-w-[720px] max-md:mt-0 max-md:mb-0">
        <SkeletonFrame className="flex flex-col gap-4 border border-edge bg-card px-[7%] pt-9 pb-14 shadow-card max-md:border-x-0 max-md:border-t-0 max-md:shadow-none">
          <SkeletonBlock className="h-3 w-28" />
          <SkeletonBlock className="h-7 w-2/3" />
          <div className="mt-4 flex flex-col gap-3">
            <SkeletonBlock className="h-3.5 w-full" />
            <SkeletonBlock className="h-3.5 w-full" />
            <SkeletonBlock className="h-3.5 w-5/6" />
            <SkeletonBlock className="h-3.5 w-full" />
            <SkeletonBlock className="h-3.5 w-2/3" />
          </div>
        </SkeletonFrame>
      </LoadingRegion>
    </div>
  );
}
