import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminFooter } from "@/components/admin/AdminFooter";
import { AdminNav } from "@/components/admin/AdminNav";
import { PostStats } from "@/components/admin/PostStats";
import { ADMIN_LOGIN_PATH } from "@/lib/auth/adminPaths";
import { getAdminUser } from "@/lib/auth/adminSession";

/**
 * A-09 글 하나의 추이 — 페이지.
 *
 * 목록에서 누르면 이 페이지가 아니라 모달이 열린다(`@modal/(..)stats/[postId]`). 여기는 새로고침·
 * 직접 접속·모달의 "통계 상세"로 오는 자리다. 본문은 `PostStats` 한 곳에 있다.
 */
/**
 * 목록과 레이아웃(`stats/layout.tsx`)을 함께 쓰게 되면서, 둘 사이를 오갈 때 Next가 "즉시 반응할
 * 껍데기가 없다"고 알린다. 목록(`../page.tsx`)과 같은 이유 — 요청이 있어야 무엇을 그릴지 정해진다.
 */
export const instant = false;

export default async function AdminPostStatsPage({ params }: PageProps<"/admin/stats/[postId]">) {
  const user = await getAdminUser();
  if (!user) redirect(ADMIN_LOGIN_PATH);

  const { postId } = await params;

  return (
    <div className="flex min-h-full flex-col bg-paper">
      <AdminNav />

      <main className="mx-auto flex w-full max-w-[760px] flex-col gap-8 px-[5%] py-8">
        <Link
          href="/admin/stats"
          className="font-typewriter text-[10.5px] text-faint hover:text-ink"
        >
          ← 통계
        </Link>

        <PostStats postId={postId} />
      </main>
      <AdminFooter />
    </div>
  );
}
