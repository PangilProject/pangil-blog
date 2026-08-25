import { renderSiteOgCard } from "@/lib/og/card";
import { SITE_CODE, siteBrand } from "@/lib/site/brand";
import { siteBaseUrl } from "@/lib/site/publicUrl";
import { isSiteKey } from "@/lib/site/resolveSite";

/**
 * 지면 카드 — `/api/og/site/{site}`.
 *
 * 글에는 카드가 있었지만(04 §3.5) 목록·태그·허브에는 없었다. 링크를 공유하면 카카오톡이
 * 이미지 없는 회색 칸을 그렸다 — 정작 사람이 가장 먼저 보내는 주소가 그 지면들이다.
 *
 * 글 카드와 달리 DB를 보지 않는다. 그려야 할 것이 표시명과 소개뿐이라 조회할 것이 없다.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;

  if (!isSiteKey(site)) return new Response("not found", { status: 404 });

  const brand = siteBrand(site);
  const png = await renderSiteOgCard({
    site,
    name: brand.name,
    description: brand.description,
    code: SITE_CODE[site],
    // 카드에 적는 주소. 도메인이 미확정이면 지금 서 있는 호스트가 그대로 적힌다(08 §3)
    host: new URL(siteBaseUrl(site, { host: null })).host,
  });

  return new Response(new Uint8Array(png), {
    headers: {
      "content-type": "image/png",
      // 표시명이 바뀌어야 바뀌는 그림이다. 그래도 상한을 둔다 — CDN에 남은 응답은
      // 발행 태그로 지워지지 않는다(무효화가 닿는 곳은 `use cache`까지다)
      "cache-control": "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
