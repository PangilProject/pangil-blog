import { redirect } from "next/navigation";
import { Suspense } from "react";

import { PostStats } from "@/components/admin/PostStats";
import { StatModal } from "@/components/admin/StatModal";
import { ADMIN_LOGIN_PATH } from "@/lib/auth/adminPaths";
import { getAdminUser } from "@/lib/auth/adminSession";

/**
 * 목록에서 누른 글의 추이를 목록 위에 띄운다 (A-09).
 *
 * **틀이 먼저, 숫자는 뒤에.** 틀을 Suspense 밖에 두어 누른 순간 모달이 뜨게 한다 — 쿼리가
 * 끝날 때까지 아무것도 안 바뀌면 클릭이 안 먹은 것처럼 보인다.
 */
export default function InterceptedPostStats({ params }: PageProps<"/admin/stats/[postId]">) {
  return (
    <StatModal>
      <Suspense fallback={<ModalSkeleton />}>
        <Body params={params} />
      </Suspense>
    </StatModal>
  );
}

async function Body({ params }: { params: PageProps<"/admin/stats/[postId]">["params"] }) {
  // 페이지와 같은 검사다 — 모달이라고 문이 하나 줄지 않는다
  const user = await getAdminUser();
  if (!user) redirect(ADMIN_LOGIN_PATH);

  const { postId } = await params;
  return <PostStats postId={postId} inModal />;
}

function ModalSkeleton() {
  return (
    <>
      <h1 id="post-stats-title" className="font-serif text-lg text-faint">
        불러오는 중…
      </h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((key) => (
          <div key={key} className="h-[74px] border border-edge bg-card" />
        ))}
      </div>
      <div className="h-[220px] border border-edge bg-card" />
    </>
  );
}
