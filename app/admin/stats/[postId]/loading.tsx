import { AdminScreenSkeleton } from "@/components/admin/AdminScreenSkeleton";
import { SkeletonFrame } from "@/components/record/Skeleton";

/**
 * 글 하나의 통계를 **새 화면으로** 열었을 때(새로고침·직접 접속). 목록에서 누른 이동은 모달이
 * 가로채므로 이 틀이 아니라 모달의 자리 표시가 선다.
 */
export default function AdminPostStatsLoading() {
  return (
    <AdminScreenSkeleton width="max-w-[760px]" gap="gap-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((key) => (
          <SkeletonFrame key={key} className="h-[74px] border border-edge bg-card" />
        ))}
      </div>
      <SkeletonFrame className="h-[220px] border border-edge bg-card" />
    </AdminScreenSkeleton>
  );
}
