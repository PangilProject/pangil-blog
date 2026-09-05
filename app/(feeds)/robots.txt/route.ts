import { absoluteUrl } from "@/lib/site/publicUrl";
import { isPreviewHost, resolveSite, siteHostsFromEnv } from "@/lib/site/resolveSite";

/**
 * robots.txt (07 M6 검색엔진 제출).
 *
 * 지면별이다 — sitemap과 같은 이유로 검색엔진은 호스트 단위로 이 파일을 읽는다.
 * 파일이 아니라 라우트인 것도 그래서다: 3면이 한 앱이라 정적 파일 하나로는 답이 갈리지 않는다.
 *
 * **막는 것**
 *
 * - `/admin` — 로그인으로 튕겨낼 뿐 크롤러의 요청은 이미 소비된다. 색인 가치가 0인 곳에
 *   크롤 예산을 쓰지 않는다
 * - `/api` — 사람이 읽을 것이 없다. 통계 수집 경로(`/api/stat`)가 크롤러의 방문으로
 *   더럽혀지는 것도 막는다
 *
 * 검색 결과·개인정보처리방침은 여기서 막지 않는다. 각 지면이 `noindex`를 이미 달고 있고
 * (`robots` 메타), 그쪽이 더 정확하다 — robots.txt로 막으면 크롤러가 페이지를 못 읽어서
 * `noindex`조차 못 본다.
 *
 * **아직 최종 도메인이 아닌 호스트는 통째로 막는다.** 지금 살아 있는 곳은
 * `pangil-blog.vercel.app`이고 도메인은 출시 게이트다(07 §4). 그 주소가 색인되면 도메인이
 * 붙는 날 같은 글이 두 주소로 걸린다 — 새 도메인은 중복으로 취급받는 쪽에서 시작한다.
 * 주소 개편으로 죽은 주소 천여 개(05 §6.4)가 크롤 예산을 먹는 것도 여기서 함께 멈춘다.
 */
export function GET(request: Request) {
  const host = request.headers.get("host");

  if (isPreviewHost(host)) {
    return robots(["User-agent: *", "Disallow: /"]);
  }

  const site = resolveSite({
    host,
    siteParam: new URL(request.url).searchParams.get("site"),
    hosts: siteHostsFromEnv(process.env),
  });

  return robots([
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /api",
    "",
    `Sitemap: ${absoluteUrl(site, "/sitemap.xml", { host })}`,
  ]);
}

function robots(lines: string[]): Response {
  return new Response(`${lines.join("\n")}\n`, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
}
