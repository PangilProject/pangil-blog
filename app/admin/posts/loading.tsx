import { AdminScreenSkeleton, SkeletonRows } from "@/components/admin/AdminScreenSkeleton";
import { SkeletonBlock } from "@/components/record/Skeleton";

/**
 * 글 관리(A-05)가 오는 동안.
 *
 * 필터·검색·페이지를 바꾸는 이동에서는 이 틀이 서지 않는다 — 같은 지면에서 검색어만 바뀌면
 * Next가 경계를 새로 세우지 않고 지금 목록을 남긴 채 기다린다. 그게 맞다: 목록이 통째로
 * 사라졌다 돌아오는 것보다 지금 것을 들고 있는 편이 덜 흔들린다.
 */
export default function AdminPostsLoading() {
  return (
    <AdminScreenSkeleton width="max-w-[720px]" title="글 관리">
      <SkeletonBlock className="h-8 w-full" />
      <SkeletonRows count={8} />
    </AdminScreenSkeleton>
  );
}
