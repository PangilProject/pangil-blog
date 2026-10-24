import { AdminScreenSkeleton } from "@/components/admin/AdminScreenSkeleton";
import { SkeletonBlock, SkeletonFrame } from "@/components/record/Skeleton";

/** 대시보드(A-01)가 오는 동안. 제목은 오늘 날짜라 막대로 둔다 — 껍데기는 시계를 못 본다 */
export default function AdminHomeLoading() {
  return (
    <AdminScreenSkeleton width="max-w-[760px]" gap="gap-7">
      <SkeletonBlock className="h-3 w-48" />

      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1].map((key) => (
          <SkeletonFrame
            key={key}
            className="flex h-[168px] flex-col gap-3 border border-edge bg-card p-5"
          >
            <SkeletonBlock className="h-3 w-20" />
            <SkeletonBlock className="h-4 w-3/4" />
            <SkeletonBlock className="mt-auto h-3 w-24" />
          </SkeletonFrame>
        ))}
      </div>

      <div className="flex gap-2">
        <SkeletonBlock className="h-9 w-24" />
        <SkeletonBlock className="h-9 w-24" />
      </div>
    </AdminScreenSkeleton>
  );
}
