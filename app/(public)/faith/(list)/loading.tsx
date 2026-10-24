import { ListPageSkeleton } from "@/components/public/ListPageSkeleton";

/**
 * 목록·태그 목록으로 가는 동안. 페이지·검색어만 바뀌는 이동에서는 서지 않는다 — 같은 세그먼트라
 * Next가 지금 목록을 남긴 채 기다린다.
 */
export default function FaithListLoading() {
  return <ListPageSkeleton site="faith" />;
}
