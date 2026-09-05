import { cacheTag } from "next/cache";
import { notFound } from "next/navigation";

import { JsonLd } from "@/components/public/JsonLd";
import { PostDetail } from "@/components/public/PostDetail";
import { PostNeighbors } from "@/components/public/PostNeighbors";
import { SiteHeader } from "@/components/public/SiteHeader";
import { findNeighbors, findPublishedPostBySlug } from "@/lib/db/publicPosts";
import { TYPE_LABELS } from "@/lib/record/axis";
import { listTag, postTag } from "@/lib/revalidate/tags";
import { articleJsonLd } from "@/lib/seo/jsonLd";
import { ogImage, openGraphBase, siteAlternates } from "@/lib/site/metadata";

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
  // listTag도 함께 붙인다 — 이전글·다음글은 **다른 글이 발행되면** 바뀐다. 글 자신의 태그만
  // 붙이면 이웃이 낡은 채로 남는다. 대가는 새 글 하나가 그 지면 상세 캐시를 만료시키는
  // 것이고, 다시 만들어지는 건 실제로 방문된 지면뿐이다
  cacheTag(postTag(post.id), listTag("faith"));

  const neighbors = await findNeighbors("faith", { kind: "type", type: post.type }, post);

  return (
    <main className="flex w-full flex-col gap-8">
      <JsonLd
        data={articleJsonLd({
          site: "faith",
          title: post.title,
          description: post.excerpt,
          path: `/faith/${slug}`,
          publishedAt: post.publishedAt,
          updatedAt: post.updatedAt,
          imagePath: `/api/og/${post.id}`,
          tags: post.tags,
        })}
      />

      <SiteHeader site="faith" />

      <PostDetail post={post} />

      <PostNeighbors
        previous={neighbors.previous}
        next={neighbors.next}
        axisLabel={TYPE_LABELS[post.type]}
      />
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
    openGraph: {
      // openGraph는 부모와 깊게 병합되지 않는다 — 지면 이름·로케일을 여기서 다시 편다
      ...openGraphBase("faith"),
      title: post.title,
      description: post.excerpt ?? undefined,
      type: "article",
      publishedTime: post.publishedAt?.toISOString(),
      // 기록 카드를 그대로 1200×630으로 재조판한다(04 §3.5) — 썸네일 미지정 글의 폴백을 겸한다
      images: ogImage("faith", `/api/og/${post.id}`, post.title),
    },
    twitter: { card: "summary_large_image" },
    alternates: siteAlternates("faith", `/faith/${slug}`),
  };
}
