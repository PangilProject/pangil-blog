import { AdminScreenSkeleton } from "@/components/admin/AdminScreenSkeleton";
import { SkeletonBlock, SkeletonFrame } from "@/components/record/Skeleton";

/**
 * 통계(A-07)가 오는 동안.
 *
 * **이 파일은 `stats/` 바로 아래가 아니라 `(list)` 안에 있다.** 거기 두면 병렬 슬롯 `@modal`까지
 * 감싸서, 목록에서 글 하나를 눌러 모달을 띄울 때 모달 자리에 이 큰 틀이 선다. 모달은 자기 몫의
 * 자리 표시(`@modal/(..)stats/[postId]`의 ModalSkeleton)를 따로 갖는다.
 */
export default function AdminStatsLoading() {
  return (
    <AdminScreenSkeleton width="max-w-[1040px]" gap="gap-8" title="통계">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((key) => (
          <SkeletonFrame key={key} className="h-[74px] border border-edge bg-card" />
        ))}
      </div>
      <SkeletonFrame className="h-[220px] border border-edge bg-card" />
      <div className="grid gap-8 sm:grid-cols-2">
        <SkeletonBlock className="h-40" />
        <SkeletonBlock className="h-40" />
      </div>
    </AdminScreenSkeleton>
  );
}
