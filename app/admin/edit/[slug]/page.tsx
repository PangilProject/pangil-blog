import { notFound, redirect } from "next/navigation";

import { ADMIN_LOGIN_PATH } from "@/lib/auth/adminPaths";
import { getAdminUser } from "@/lib/auth/adminSession";
import { findPostIdBySlug } from "@/lib/db/posts";
import { editorPath } from "@/lib/record/todayCard";

/**
 * 공개 지면 → 에디터 (A-03b "수정 진입").
 *
 * 읽고 있던 글을 그 자리에서 고치러 가는 길이다. 공개 상세 하단의 `수정`이 여기로 온다.
 *
 * **지면은 세션을 보지 않는다**(04 §1.2 · 05 §4.1 — 정적 캐시를 지키는 전제다). 그래서
 * 링크는 누구에게나 그려지고, **갈리는 곳은 이 라우트다**:
 * - 세션이 있으면 그 글의 에디터로
 * - 없으면 로그인을 지나 같은 자리로 (proxy가 가려던 경로를 `next`로 실어 보낸다)
 *
 * slug를 쓰는 이유는 공개 지면이 아는 것이 slug뿐이기 때문이다. id를 노출하지 않아도 된다.
 *
 * 미인증 요청은 proxy가 먼저 잡는다. 아래 검사는 관리 지면의 공통 규약이고(05 §3.2),
 * 라우트가 늘 때마다 이 줄을 빠뜨리면 그게 곧 구멍이다 — 그래서 여기서도 `next`를 잃지 않는다.
 */
export default async function AdminEditBySlugPage({ params }: PageProps<"/admin/edit/[slug]">) {
  const { slug } = await params;

  const user = await getAdminUser();
  if (!user) {
    const next = new URLSearchParams({ next: `/admin/edit/${slug}` });
    redirect(`${ADMIN_LOGIN_PATH}?${next.toString()}`);
  }

  const post = await findPostIdBySlug(slug);

  // 없는 slug는 404다. 목록으로 흘려보내면 "고칠 글을 찾지 못했다"가 조용히 묻힌다
  if (!post) notFound();

  redirect(editorPath(post.type, post.id));
}
