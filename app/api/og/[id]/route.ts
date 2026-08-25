import { findOgCard } from "@/lib/db/publicPosts";
import { renderOgCard } from "@/lib/og/card";

/**
 * OG 카드 (04 §3.5) — `/api/og/{id}`.
 *
 * 이미지 생성은 lib/og/card가 하고 여기서는 조회와 응답만 맡는다. 링크 공유가 곧 브랜딩이므로
 * (04 §3.5) 캐시를 길게 잡는다 — 무효화는 발행 태그가 담당한다(04 §1.2).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await findOgCard(id);

  // Route Handler에서는 notFound()를 쓰지 않는다 — 이미지 자리에 HTML 흐름을 끼우게 된다
  if (!post) return new Response("not found", { status: 404 });

  const png = await renderOgCard(post);

  return new Response(new Uint8Array(png), {
    headers: {
      "content-type": "image/png",
      // 스크레이퍼는 링크가 공유될 때마다 찾아온다. must-revalidate로 두면 그때마다
      // satori와 resvg가 다시 돈다 — 제목이 바뀌어야 바뀌는 그림인데도. 다만 무한정
      // 두지는 않는다: CDN에 남은 응답은 발행 태그로 지워지지 않는다
      "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
