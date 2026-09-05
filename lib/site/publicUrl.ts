import type { RecordType } from "@/lib/record/callNumber";
import { publicPostPath } from "@/lib/record/paths";
import { isPreviewHost, type SiteKey, siteHostsFromEnv } from "@/lib/site/resolveSite";

/**
 * 피드·사이트맵·OG에 적을 **절대 URL** (04 §1.3 · 08 §3).
 *
 * 지면 안에서 쓰는 링크는 상대 경로면 되지만, 피드와 sitemap은 남의 프로그램이 읽으므로
 * 절대 주소여야 한다. 그런데 도메인이 아직 미확정이다(07 §4 출시 게이트) — 그래서 두 경우를
 * 모두 다룬다.
 *
 * - 도메인이 설정돼 있으면: `https://faith.○/sr-1` (지면별 호스트, 경로에 site 세그먼트 없음)
 * - 호스트가 하나면(로컬·Vercel 기본 주소): `https://○/faith/sr-1` (미들웨어가 통과시키는 경로)
 *
 * 이 갈림이 한 곳에만 있어야 한다. 피드·sitemap·OG가 각자 판단하면 그중 하나가 404를 가리킨다.
 */

export type UrlContext = {
  /** 요청 호스트 (Route Handler의 request.headers.get("host")) */
  host: string | null;
  env?: Record<string, string | undefined>;
};

function protocolFor(host: string): string {
  return host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
}

/** 지면의 기준 URL. 도메인이 설정된 경우에만 지면별 호스트를 쓴다 */
export function siteBaseUrl(site: SiteKey, { host, env = process.env }: UrlContext): string {
  const hosts = siteHostsFromEnv(env);
  const configured = site === "hub" ? hosts.root : hosts[site];

  if (configured) return `https://${configured}`;

  // 도메인 미확정 구간: 현재 호스트를 그대로 쓰고 경로에 지면을 남긴다
  const current = host ?? new URL(env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").host;
  return `${protocolFor(current)}://${current}`;
}

/** 지면 안의 경로를 절대 URL로. 도메인이 붙으면 site 세그먼트가 사라진다 */
export function absoluteUrl(site: SiteKey, path: string, context: UrlContext): string {
  const hosts = siteHostsFromEnv(context.env ?? process.env);
  const configured = site === "hub" ? hosts.root : hosts[site];
  const base = siteBaseUrl(site, context);

  const suffix = path.startsWith("/") ? path : `/${path}`;

  // 지면 호스트가 있으면 `/faith` 접두사를 떼고, 없으면 그대로 남긴다
  return `${base}${configured ? stripSitePrefix(site, suffix) : suffix}`;
}

/** 글 하나의 절대 URL */
export function absolutePostUrl(type: RecordType, slug: string, context: UrlContext): string {
  const site = type === "TECH" ? "dev" : "faith";
  return absoluteUrl(site, publicPostPath(type, slug), context);
}

/** 이 호스트가 도메인 미확정 구간인가 — 피드가 site 세그먼트를 남겨야 하는지의 판단 */
export function isSingleHost(context: UrlContext): boolean {
  const hosts = siteHostsFromEnv(context.env ?? process.env);
  return !hosts.dev && !hosts.faith && isPreviewHost(context.host);
}

/**
 * **화면 링크**의 href (04 §1.3 · 08 §3).
 *
 * `absoluteUrl`이 기계가 읽는 주소를 만든다면 이건 사람이 누르는 주소다. 갈림은 같다 —
 * 지면 호스트가 붙으면 경로에서 site 세그먼트가 사라진다.
 *
 * 이 함수가 없던 동안 화면 링크는 `/faith/sr-1`을 그대로 적었다. 호스트가 하나일 때는
 * 미들웨어가 통과시켜 맞았지만(sitePrefixOf), 도메인이 붙는 순간 `faith.○/faith/sr-1`이
 * 되고 그건 `/faith/faith/sr-1`로 리라이트돼 404다. 실제로 도메인을 붙이자 공개 지면의
 * 링크가 전부 그렇게 깨졌다 — 피드만 멀쩡했던 이유는 그쪽이 `absoluteUrl`을 쓰기 때문이다.
 *
 * - 호스트 미설정(로컬·프리뷰): 지금까지처럼 경로를 그대로 둔다
 * - 같은 지면: 접두사만 뗀 상대 경로 (`/sr-1`) — 상대여야 Next가 클라이언트 이동을 한다
 * - 다른 지면: 그 호스트의 절대 URL (`https://faith.○/`) — 호스트가 갈리면 상대로는 못 간다
 *
 * `from`을 넘기지 않으면 항상 절대 URL이다. 지금 서 있는 지면을 모르는 자리(관리 화면)가
 * 그렇다 — 거기서는 공개 지면이 늘 남의 호스트다.
 */
export function siteHref(
  target: SiteKey,
  path: string,
  { from, env = process.env }: { from?: SiteKey; env?: Record<string, string | undefined> } = {},
): string {
  const hosts = siteHostsFromEnv(env);
  const configured = target === "hub" ? hosts.root : hosts[target];

  // 도메인 미확정 구간 — 미들웨어가 site 세그먼트를 통과시키므로 경로가 곧 주소다
  if (!configured) return path.startsWith("/") ? path : `/${path}`;

  if (from === target) return stripSitePrefix(target, path);

  return absoluteUrl(target, path, { host: null, env });
}

/** `/faith/sr-1` → `/sr-1`, `/faith` → `/` */
function stripSitePrefix(site: SiteKey, path: string): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  const prefix = `/${site}`;

  if (suffix === prefix) return "/";
  // 쿼리만 붙은 지면 홈(`/faith?type=QT`)은 접두사가 전부다. `/`를 남겨야 한다 —
  // `?type=QT`만 돌려주면 상세에서 눌렀을 때 그 글 주소에 쿼리가 붙는다
  if (suffix.startsWith(`${prefix}?`)) return `/${suffix.slice(prefix.length)}`;
  if (suffix.startsWith(`${prefix}/`)) return suffix.slice(prefix.length);

  return suffix;
}

/** 글 하나로 가는 화면 링크. 경로 규칙은 `publicPostPath` 한 곳에서 온다 */
export function postHref(
  type: RecordType,
  slug: string,
  from?: SiteKey,
  env: Record<string, string | undefined> = process.env,
): string {
  const site = type === "TECH" ? "dev" : "faith";
  return siteHref(site, publicPostPath(type, slug), { from, env });
}
