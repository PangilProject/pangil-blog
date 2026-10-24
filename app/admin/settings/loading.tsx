import { AdminScreenSkeleton, SkeletonRows } from "@/components/admin/AdminScreenSkeleton";
import { SkeletonBlock } from "@/components/record/Skeleton";

/** 설정(A-08)이 오는 동안. 위 칸은 분류 목록이다 */
export default function AdminSettingsLoading() {
  return (
    <AdminScreenSkeleton width="max-w-[720px]" gap="gap-8" title="설정">
      <section className="flex flex-col gap-3">
        <SkeletonBlock className="h-4 w-24" />
        <SkeletonBlock className="h-12 w-full" />
        <SkeletonRows count={4} />
      </section>
    </AdminScreenSkeleton>
  );
}
