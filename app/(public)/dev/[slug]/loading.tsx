import { PostPageSkeleton } from "@/components/public/PostPageSkeleton";

/**
 * 글 상세로 가는 동안. 없는 글이면 이 틀 뒤에 not-found가 선다 — 응답은 이미 그랬듯 200 + noindex다
 * (사이드바의 Suspense가 먼저 흘려보내기 때문에 이 파일 전부터 그랬다).
 */
export default function DevPostLoading() {
  return <PostPageSkeleton site="dev" />;
}
