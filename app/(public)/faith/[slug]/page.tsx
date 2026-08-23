import { cacheTag } from "next/cache";
import { notFound } from "next/navigation";

import { PostDetail } from "@/components/public/PostDetail";
import { findPublishedPostBySlug } from "@/lib/db/publicPosts";
import { postTag } from "@/lib/revalidate/tags";

/**
 * F-03 묵상 글 상세 (02 §2.3).
 *
 * 경로는 `faith.○/{slug}` — slug가 전역 unique이므로(05 §1.4) 타입 세그먼트를 두지 않는다.
 * `{qt|sr|pr}-{청구기호}`가 이미 타입을 말한다.
 */
/**
 * 빌드 시점에는 어떤 slug가 있을지 모르므로(발행은 계속 일어난다) 껍데기를 미리 그리지 않고
 * 첫 요청에서 만들어 캐시한다. `use cache` + `post:{id}` 태그라 발행 즉시 갱신된다.
 */
export const instant = false;

export default async function FaithPostPage({ params }: PageProps<"/faith/[slug]">) {
  // 지면 전체를 캐시한다(ADR-003). 무효화는 조회 함수가 붙인 `post:{id}` 태그가 담당하므로,
  // 발행·수정·삭제만 이 페이지를 바꾼다 — 시간 기반 만료는 쓰지 않는다(04 결정 로그 #1)
  "use cache";

  const { slug } = await params;
  const post = await findPublishedPostBySlug("faith", slug);

  if (!post) notFound();

  // 이 지면의 캐시 항목에도 태그를 명시한다. 안쪽 조회에만 붙이면 조회 결과는 새로 읽히는데
  // 이미 만들어진 HTML이 그대로 남는다 — 언어를 고쳐도 지면이 안 바뀌던 이유다
  cacheTag(postTag(post.id));

  return (
    <main className="px-[5%] py-10">
      <PostDetail post={post} />
    </main>
  );
}

export async function generateMetadata({ params }: PageProps<"/faith/[slug]">) {
  "use cache";

  const { slug } = await params;
  const post = await findPublishedPostBySlug("faith", slug);

  if (!post) return {};

  cacheTag(postTag(post.id));

  return {
    title: post.title,
    description: post.excerpt ?? undefined,
  };
}
