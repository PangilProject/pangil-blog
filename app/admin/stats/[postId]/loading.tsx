import { AdminScreenSkeleton } from "@/components/admin/AdminScreenSkeleton";
import { PostStatsSkeleton } from "@/components/admin/PostStatsSkeleton";

/**
 * 글 하나의 통계를 **새 화면으로** 열었을 때(새로고침·직접 접속). 목록에서 누른 이동은 모달이
 * 가로채므로 이 틀이 아니라 모달의 자리 표시가 선다 — 둘은 같은 PostStatsSkeleton이다.
 */
export default function AdminPostStatsLoading() {
  return (
    <AdminScreenSkeleton width="max-w-[760px]" gap="gap-8" title={null}>
      <PostStatsSkeleton />
    </AdminScreenSkeleton>
  );
}
