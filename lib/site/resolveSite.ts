/**
 * 호스트 → 3면(허브/기술/묵상) 분기 규칙. 04 §1.3.
 *
 * 도메인·서브도메인 명칭은 배포 직전 확정이므로 코드에 하드코딩하지 않는다(08 §3).
 * 실제 호스트는 env(SITE_HOST_ROOT / SITE_HOST_DEV / SITE_HOST_FAITH)로 주입하고,
 * 미설정 시에는 서브도메인 라벨(dev. / faith.)로 폴백한다.
 */

export const SITE_KEYS = ["hub", "dev", "faith"] as const;

export type SiteKey = (typeof SITE_KEYS)[number];

export const DEFAULT_SITE: SiteKey = "hub";

export type SiteHostConfig = {
  root?: string;
  dev?: string;
  faith?: string;
};

export type ResolveSiteInput = {
  /** Host 헤더 값. 포트·대소문자 포함 가능 */
  host: string | null | undefined;
  /** 개발 폴백용 ?site= 쿼리 값 */
  siteParam?: string | null;
  hosts?: SiteHostConfig;
  /** 개발 폴백 허용 여부 (프로덕션 도메인에서는 ?site=를 무시한다) */
  allowSiteParam?: boolean;
};

export function isSiteKey(value: string | null | undefined): value is SiteKey {
  return typeof value === "string" && (SITE_KEYS as readonly string[]).includes(value);
}

/** 포트를 떼고 소문자로 정규화한 호스트명 */
export function normalizeHost(host: string | null | undefined): string {
  if (!host) return "";
  return host.trim().toLowerCase().split(":")[0] ?? "";
}

/**
 * 개발 중에는 Vercel 기본 주소·로컬호스트에서 ?site= 로 3면을 전환한다(08 §3).
 * 실제 도메인에서는 캐시·정규 URL 혼선을 막기 위해 허용하지 않는다.
 */
export function isPreviewHost(host: string | null | undefined): boolean {
  const name = normalizeHost(host);
  if (!name) return false;
  return (
    name === "localhost" ||
    name === "127.0.0.1" ||
    name === "0.0.0.0" ||
    name.endsWith(".localhost") ||
    name.endsWith(".vercel.app")
  );
}

export function resolveSite({
  host,
  siteParam,
  hosts = {},
  allowSiteParam,
}: ResolveSiteInput): SiteKey {
  const name = normalizeHost(host);
  const previewFallbackAllowed = allowSiteParam ?? isPreviewHost(name);

  if (previewFallbackAllowed && isSiteKey(siteParam)) {
    return siteParam;
  }

  const root = normalizeHost(hosts.root);
  const dev = normalizeHost(hosts.dev);
  const faith = normalizeHost(hosts.faith);

  if (dev && name === dev) return "dev";
  if (faith && name === faith) return "faith";
  if (root && name === root) return "hub";

  // env 미설정 폴백: 서브도메인 라벨로 판단한다.
  const label = name.split(".")[0];
  if (label === "dev" || label === "tech") return "dev";
  if (label === "faith") return "faith";

  return DEFAULT_SITE;
}

/** env에서 3호스트 설정을 읽는다. Vercel에 명시 등록하는 3개 호스트(04 §1.3). */
export function siteHostsFromEnv(env: Record<string, string | undefined>): SiteHostConfig {
  return {
    root: env.SITE_HOST_ROOT,
    dev: env.SITE_HOST_DEV,
    faith: env.SITE_HOST_FAITH,
  };
}

/** 호스트 분기 결과를 실제 라우트 경로로 바꾼다. `/` → `/hub`, `/tags/x` → `/faith/tags/x` */
export function siteRewritePath(site: SiteKey, pathname: string): string {
  const suffix = pathname === "/" ? "" : pathname;
  return `/${site}${suffix}`;
}
