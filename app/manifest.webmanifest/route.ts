import type { MetadataRoute } from "next";

import { THEME_COLOR } from "@/lib/og/palette";
import { BRAND_MARK, siteBrand } from "@/lib/site/brand";
import { absoluteUrl, siteBaseUrl } from "@/lib/site/publicUrl";
import { resolveSite, siteHostsFromEnv } from "@/lib/site/resolveSite";

/**
 * 앱 매니페스트 — 홈 화면에 담겼을 때의 이름과 아이콘.
 *
 * `app/manifest.ts` 규약 대신 라우트 핸들러인 이유는 **호스트마다 답이 달라야** 하기
 * 때문이다. 세 면이 한 앱이라 매니페스트가 하나면 dev를 담아도 "믿음의 기록"이 뜬다.
 * 규약 파일은 정적으로 굳으므로 호스트를 볼 수 없다.
 *
 * 프록시는 점이 있는 경로를 건드리지 않으므로(`proxy.ts` matcher) 이 경로는 어느 호스트에서도
 * 리라이트 없이 그대로 닿는다.
 */
export async function GET(request: Request): Promise<Response> {
  const host = request.headers.get("host");
  const url = new URL(request.url);

  const site = resolveSite({
    host,
    // 개발 중 3면 전환은 여기서도 통한다 — 매니페스트만 허브로 뜨면 확인이 안 된다(08 §3)
    siteParam: url.searchParams.get("site"),
    hosts: siteHostsFromEnv(process.env),
  });

  const brand = siteBrand(site);
  // 도메인이 붙으면 지면 루트가 곧 "/"이고, 호스트가 하나면 `/dev` 같은 경로가 남는다
  const start = absoluteUrl(site, `/${site}`, { host });

  /**
   * scope는 **호스트 전체**다. start_url의 경로로 좁히면 안 된다 — iOS는 scope 밖 이동을
   * 앱 안에서 처리하지 않고 브라우저 UI를 띄운 화면으로 넘긴다(홈 화면에 담은 뒤 허브에서
   * "읽으러 가기"를 누르면 위아래로 Safari 막대가 나타났다. 실제로 그랬다).
   *
   * 도메인이 붙으면 호스트가 곧 지면이라 이 값이 자연히 면별로 갈린다. 지금처럼 호스트가
   * 하나인 구간에서는 세 면이 한 앱 안에 있게 된다 — 그게 담은 사람이 기대하는 동작이다.
   */
  const scope = `${siteBaseUrl(site, { host })}/`;

  const manifest: MetadataRoute.Manifest = {
    name: brand.name,
    short_name: BRAND_MARK,
    ...(brand.description ? { description: brand.description } : {}),
    lang: "ko",
    start_url: start,
    scope,
    // iOS에서 minimal-ui는 "브라우저 컨트롤을 최소로 **보여달라**"는 뜻이다. 앱처럼 뜨는
    // 것을 원하면 standalone이어야 한다
    display: "standalone",
    background_color: THEME_COLOR.light,
    theme_color: THEME_COLOR.light,
    icons: [192, 512].map((size) => ({
      src: `/icons/${site}-${size}.png`,
      sizes: `${size}x${size}`,
      type: "image/png",
    })),
  };

  return Response.json(manifest, {
    headers: {
      "content-type": "application/manifest+json",
      // 아이콘·이름은 배포마다 바뀌지 않는다. 하루 캐시하고 배포 시 자연히 갈린다
      "cache-control": "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
