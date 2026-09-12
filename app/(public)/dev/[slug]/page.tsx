import { cacheTag } from "next/cache";
import { notFound } from "next/navigation";

import { JsonLd } from "@/components/public/JsonLd";
import { PostDetail } from "@/components/public/PostDetail";
import { PostNeighbors } from "@/components/public/PostNeighbors";
import { SiteHeader } from "@/components/public/SiteHeader";
import { Toc } from "@/components/public/Toc";
import { findNeighbors, findPublishedPostBySlug } from "@/lib/db/publicPosts";
import { collectHeadings } from "@/lib/render/richText";
import { listTag, postTag } from "@/lib/revalidate/tags";
import { articleJsonLd } from "@/lib/seo/jsonLd";
import { ogImage, openGraphBase, siteAlternates } from "@/lib/site/metadata";

/**
 * D-02 기술 글 상세 (02 §2.2) — SEO 주력 지면.
 *
 * 경로는 `dev.○/{slug}`. 제목 kebab이 그대로 URL이 되고, 한글 제목이면
 * `post-{청구기호}` 폴백이다(05 §6.4). 목차·하이라이팅은 슬라이스 2에서 붙는다.
 */
/**
 * 빌드 시점에는 어떤 slug가 있을지 모르므로(발행은 계속 일어난다) 껍데기를 미리 그리지 않고
 * 첫 요청에서 만들어 캐시한다. `use cache` + `post:{id}` 태그라 발행 즉시 갱신된다.
 */
export const instant = false;

export default async function DevPostPage({ params }: PageProps<"/dev/[slug]">) {
  // 지면 전체를 캐시한다(ADR-003). 무효화는 조회 함수가 붙인 `post:{id}` 태그가 담당하므로,
  // 발행·수정·삭제만 이 페이지를 바꾼다 — 시간 기반 만료는 쓰지 않는다(04 결정 로그 #1)
  "use cache";

  const { slug } = await params;
  const post = await findPublishedPostBySlug("dev", slug);

  if (!post) notFound();

  // 이 지면의 캐시 항목에도 태그를 명시한다. 안쪽 조회에만 붙이면 조회 결과는 새로 읽히는데
  // 이미 만들어진 HTML이 그대로 남는다 — 언어를 고쳐도 지면이 안 바뀌던 이유다
  // listTag도 함께 붙인다 — 이전글·다음글은 **다른 글이 발행되면** 바뀐다. 글 자신의 태그만
  // 붙이면 이웃이 낡은 채로 남는다. 대가는 새 글 하나가 그 지면 상세 캐시를 만료시키는
  // 것이고, 다시 만들어지는 건 실제로 방문된 지면뿐이다
  cacheTag(postTag(post.id), listTag("dev"));

  // 이 지면의 축은 카테고리다(02 §5.5). 카테고리 없는 이관 글은 지면 전체에서 잇는다 —
  // 적재기가 티스토리 카테고리 없는 글을 null로 넣는다(05 §6)
  const neighbors = await findNeighbors(
    "dev",
    post.categorySlug ? { kind: "category", categorySlug: post.categorySlug } : { kind: "site" },
    post,
  );

  // 목차는 본문 밖 우측 여백에 서므로(04 §3.4) 지면 바깥에서 제목을 훑는다
  const headings =
    post.content.ok && post.content.content.kind === "TECH"
      ? collectHeadings(post.content.content.body)
      : [];

  return (
    <main className="group/page flex w-full flex-col gap-8">
      <JsonLd
        data={articleJsonLd({
          site: "dev",
          title: post.title,
          description: post.excerpt,
          path: `/dev/${slug}`,
          publishedAt: post.publishedAt,
          updatedAt: post.updatedAt,
          imagePath: `/api/og/${post.id}`,
          tags: post.tags,
        })}
      />

      <SiteHeader site="dev" foldsToc />

      {/*
        데스크탑에서는 사이드바 + 지면 + 목차 세 칸이다. 지면 폭은 본문 가독 폭(--container-measure)에
        묶여 있고, 목차는 그 옆에 붙는다 — 지면을 좁히지 않는다
      */}
      <div className="flex w-full mx-auto max-w-[calc(var(--container-sheet)+15rem)] flex-col lg:flex-row lg:items-start lg:gap-10">
        <div className="order-2 flex min-w-0 flex-1 flex-col gap-8 lg:order-1">
          <PostDetail post={post} />

          <PostNeighbors
            previous={neighbors.previous}
            next={neighbors.next}
            axisLabel={post.categoryName ?? "기술"}
          />
        </div>

        {/*
          목차는 한 번만 놓는다. 모바일에서는 본문 위 접이식, 데스크탑에서는 우측 여백
          sticky인데(04 §3.4) 그 둘은 Toc 안에서 갈린다 — 두 벌로 놓으면 하이라이트 관찰자가
          두 개 돌고 nav 랜드마크가 중복된다
        */}
        {/*
          sticky는 **flex 아이템**에 걸어야 한다. 안쪽 nav에 걸면 그 부모(이 div)가 nav 높이만큼만
          커서 붙어 움직일 여지가 없다 — 목차가 스크롤을 따라오지 않던 이유다
        */}
        {/*
          접기는 헤더의 손잡이가 켠다(SiteHeader). 넓은 화면에서만 걷어내는 이유는 좁은 화면의
          목차가 본문 위 접이식이라 이미 접혀 있어서다 — 그쪽까지 걷으면 목차가 아예 사라진다
        */}
        <div className="order-1 lg:sticky lg:top-10 lg:order-2 lg:max-h-[calc(100vh-5rem)] lg:flex-none lg:overflow-y-auto lg:group-has-[#toc-fold:checked]/page:hidden">
          <Toc headings={headings} />
        </div>
      </div>
    </main>
  );
}

export async function generateMetadata({ params }: PageProps<"/dev/[slug]">) {
  "use cache";

  const { slug } = await params;
  const post = await findPublishedPostBySlug("dev", slug);

  if (!post) return {};

  cacheTag(postTag(post.id));

  return {
    title: post.title,
    description: post.excerpt ?? undefined,
    openGraph: {
      // openGraph는 부모와 깊게 병합되지 않는다 — 지면 이름·로케일을 여기서 다시 편다
      ...openGraphBase("dev"),
      title: post.title,
      description: post.excerpt ?? undefined,
      type: "article",
      publishedTime: post.publishedAt?.toISOString(),
      // 기록 카드를 그대로 1200×630으로 재조판한다(04 §3.5) — 썸네일 미지정 글의 폴백을 겸한다
      images: ogImage("dev", `/api/og/${post.id}`, post.title),
    },
    twitter: { card: "summary_large_image" },
    alternates: siteAlternates("dev", `/dev/${slug}`),
  };
}
