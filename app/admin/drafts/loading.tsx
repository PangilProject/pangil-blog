import { AdminScreenSkeleton, SkeletonRows } from "@/components/admin/AdminScreenSkeleton";

/** 초안함(A-04)이 오는 동안 */
export default function AdminDraftsLoading() {
  return (
    <AdminScreenSkeleton width="max-w-[720px]" title="초안함">
      <SkeletonRows count={5} />
    </AdminScreenSkeleton>
  );
}
