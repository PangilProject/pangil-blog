import { notFound, redirect } from "next/navigation";

import { ADMIN_LOGIN_PATH } from "@/lib/auth/adminPaths";
import { getAdminUser } from "@/lib/auth/adminSession";
import { findPostIdBySlug } from "@/lib/db/posts";
import { editorPath } from "@/lib/record/todayCard";

/**
 * 공개 지면 → 에디터 (A-03 "수정 진입").
 *
 * 읽고 있던 글을 그 자리에서 고치러 가는 길이다. **공개 지면에는 아무 버튼도 두지 않는다** —
 * 그쪽은 정적으로 렌더되고 세션을 보지 않기 때문이다(05 §4.1 · 04 §1.2). 관리자 여부로
 * 버튼을 갈라 그리려면 지면 캐시를 버리거나 클라이언트 아일랜드를 하나 늘려야 하는데,
 * 그 대가로 얻는 것이 링크 하나다.
 *
 * 대신 이 경로가 slug를 id로 바꿔준다. 진입은 북마크릿 한 줄이다 — 보고 있는 글에서 누르면
 * 그 글의 에디터로 온다:
 *
 *   javascript:(function(){var p=location.pathname.split('/').filter(Boolean);
 *   var s=p[p.length-1];if(s)location.href=location.origin+'/admin/edit/'+s;})()
 *
 * 미인증 요청은 proxy가 이미 A-00으로 보낸다. 여기서 한 번 더 보는 것은 관리 지면의
 * 공통 규약이고(05 §3.2), 라우트가 늘 때마다 이 줄을 빠뜨리면 그게 곧 구멍이다.
 */
export default async function AdminEditBySlugPage({ params }: PageProps<"/admin/edit/[slug]">) {
  const user = await getAdminUser();
  if (!user) redirect(ADMIN_LOGIN_PATH);

  const { slug } = await params;
  const post = await findPostIdBySlug(slug);

  // 없는 slug는 404다. 목록으로 흘려보내면 "고칠 글을 찾지 못했다"가 조용히 묻힌다
  if (!post) notFound();

  redirect(editorPath(post.type, post.id));
}
