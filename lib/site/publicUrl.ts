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
  if (configured) {
    const prefix = `/${site}`;
    const stripped = suffix === prefix ? "/" : suffix.replace(new RegExp(`^${prefix}/`), "/");
    return `${base}${stripped}`;
  }

  return `${base}${suffix}`;
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
