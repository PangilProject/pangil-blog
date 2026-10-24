import { Panel } from "@/components/admin/StatShell";
import { SkeletonBlock, SkeletonFrame } from "@/components/record/Skeleton";

/** 줄 높이를 진짜 글자와 같은 글꼴이 세우게 하는 폭 없는 공백 — 막대 높이를 숫자로 박지 않는다 */
const LINE = "​";

/**
 * 글 하나의 통계(PostStats)가 오는 동안. 모달(`@modal/(..)stats/[postId]`)과 새 화면
 * (`stats/[postId]/loading.tsx`)이 같이 쓴다.
 *
 * **모양을 PostStats에서 그대로 가져온다** — 제목, 버튼 줄, 칸 네 개, 일별 패널. 전에는 제목과 칸
 * 몇 개만 있어서 숫자가 들어오는 순간 모달이 위아래로 80px 늘며 가운데 정렬 때문에 상자 전체가
 * 위로 뛰었다(2026-10-25 브라우저 확인). 칸·패널의 줄 높이는 진짜 칸과 같은 글꼴 클래스가 정한다.
 *
 * 모달의 제목은 대화상자의 이름이라(StatModal `aria-labelledby`) 자리 표시 중에도 글자로 둔다.
 */
export function PostStatsSkeleton({ inModal = false }: { inModal?: boolean }) {
  return (
    <>
      <div className="flex flex-col gap-3">
        <h1 id={inModal ? "post-stats-title" : undefined} className="font-serif text-lg text-faint">
          불러오는 중…
        </h1>
        <div className="flex flex-wrap gap-2">
          {(inModal ? [0, 1, 2] : [0, 1]).map((key) => (
            <SkeletonFrame
              key={key}
              className="border border-edge bg-card px-2.5 py-1 font-typewriter text-[11px]"
            >
              <span className="inline-block w-12">{LINE}</span>
            </SkeletonFrame>
          ))}
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((key) => (
          <SkeletonFrame
            key={key}
            className="flex flex-col border border-edge bg-card px-4 py-3 shadow-card"
          >
            <p className="font-typewriter text-[10px] tracking-[0.14em]">
              <SkeletonBlock className="inline-block h-2.5 w-14 align-middle" />
              {LINE}
            </p>
            <p className="mt-1 font-serif text-[24px] leading-none">
              <SkeletonBlock className="inline-block h-5 w-12 align-middle" />
              {LINE}
            </p>
            <p className="mt-1.5 font-typewriter text-[10.5px]">{" "}</p>
          </SkeletonFrame>
        ))}
      </section>

      <Panel title="일별 조회">
        <div aria-hidden className="flex flex-col gap-2">
          <p className="font-typewriter text-[10px]">{LINE}</p>
          <SkeletonBlock className="h-[168px]" />
          <p className="font-typewriter text-[9px]">{LINE}</p>
        </div>
      </Panel>

      {!inModal && (
        <div className="grid gap-8 sm:grid-cols-2">
          <SkeletonBlock className="h-40" />
          <SkeletonBlock className="h-40" />
        </div>
      )}
    </>
  );
}
