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
 *
 * **높이는 실측에 맞춘다**(2026-10-25). 띠 55px · 툴바 51px, 시트는 y=132에서 시작한다(데스크탑, 네
 * 에디터 모두). 폰에서는 버튼과 툴바가 여러 줄로 감겨 띠 84px · 툴바 159px이 되는데, 그걸 몰라서
 * 틀의 시트가 y=110에 섰다가 진짜가 y=243에 들어오며 한 화면이 통째로 내려앉았다. 폰 높이는 줄
 * 수를 흉내 내지 않고 숫자로 박는다 — 감기는 줄 수는 버튼 글자에 달려 있어 틀이 따라 할 수 없다.
 * 에디터 띠·툴바의 버튼을 바꾸면 이 숫자를 다시 잰다.
 *
 * 폰의 띠는 **이어쓰기(84px)** 에 맞췄다. 새 글은 버튼이 하나 더 있어 세 줄(126px)인데, 틀은 어느
 * 쪽으로 가는지 모른다. 매일 여는 쪽(크롤러가 만든 QT 초안)을 고른다 — 새 글은 폰에서만 42px 남는다.
 *
 * 시트는 적어도 화면 높이다 — 짧으면 그동안 화면 안에 있던 푸터가 본문이 들어올 때 밀려 내려간다.
 */
export function EditorSkeleton() {
  return (
    <div className="flex flex-1 flex-col bg-paper">
      <div className="sticky top-0 z-20">
        <div className="flex flex-wrap items-center justify-between gap-3 border-edge border-b bg-paper px-[5%] py-[11px] max-md:h-[84px] max-md:items-start">
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <SkeletonBlock className="h-3 w-24" />
          </div>
          <div className="flex items-center gap-2.5">
            <SkeletonBlock className="h-8 w-16" />
            <SkeletonBlock className="h-8 w-16" />
          </div>
        </div>
        <div className="border-edge border-b bg-surface-tab px-[5%] py-[9px] max-md:h-[159px]">
          <SkeletonBlock className="h-8 w-full max-w-md" />
        </div>
      </div>

      <LoadingRegion className="mx-auto mt-[26px] mb-[50px] w-full max-w-[720px] max-md:mt-0 max-md:mb-0">
        <SkeletonFrame className="flex min-h-svh flex-col gap-4 border border-edge bg-card px-[7%] pt-9 pb-14 shadow-card max-md:border-x-0 max-md:border-t-0 max-md:shadow-none">
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
