import { cacheTag } from "next/cache";
import { notFound } from "next/navigation";

import { PostDetail } from "@/components/public/PostDetail";
import { SiteHeader } from "@/components/public/SiteHeader";
import { Toc } from "@/components/public/Toc";
import { findPublishedPostBySlug } from "@/lib/db/publicPosts";
import { collectHeadings } from "@/lib/render/richText";
import { postTag } from "@/lib/revalidate/tags";
import { ogImage, openGraphBase } from "@/lib/site/metadata";

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
  cacheTag(postTag(post.id));

  // 목차는 본문 밖 우측 여백에 서므로(04 §3.4) 지면 바깥에서 제목을 훑는다
  const headings =
    post.content.ok && post.content.content.kind === "TECH"
      ? collectHeadings(post.content.content.body)
      : [];

  return (
    <main className="mx-auto flex w-full max-w-[1080px] flex-col gap-8 px-[5%] py-10">
      <SiteHeader site="dev" />

      {/*
        데스크탑에서는 지면 + 우측 여백 두 칸이다. 지면 폭은 본문 가독 폭(--container-measure)에
        묶여 있고, 목차는 그 옆에 붙는다 — 지면을 좁히지 않는다
      */}
      <div className="mx-auto flex w-full max-w-[calc(var(--container-measure)+15rem)] flex-col lg:flex-row lg:items-start lg:gap-10">
        <div className="order-2 min-w-0 flex-1 lg:order-1">
          <PostDetail post={post} />
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
        <div className="order-1 lg:sticky lg:top-10 lg:order-2 lg:max-h-[calc(100vh-5rem)] lg:w-[13rem] lg:flex-none lg:overflow-y-auto">
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
  };
}
