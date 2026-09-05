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

/**
 * 3면 리라이트를 타지 않는 경로.
 * - /admin: 루트 도메인 경로 하나로 고정된 관리 영역(02 §1)
 * - /design: M1 확인 페이지. 개발 전용이며 프로덕션에서는 페이지 자체가 404다
 */
export const INTERNAL_PATH_PREFIXES = ["/admin", "/design"] as const;

export function isInternalPath(pathname: string): boolean {
  return INTERNAL_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * 이미 사이트 세그먼트로 시작하는 경로인가 — `/faith/sr-1`, `/dev`.
 *
 * 호스트가 하나인 환경(로컬·Vercel 기본 주소)에서는 이 경로를 **그대로 통과**시킨다. 안 그러면
 * `/faith/sr-1`이 `/hub/faith/sr-1`로 리라이트돼 404가 된다 — 발행 직후 이동이 실제로 그랬다.
 *
 * 실제 도메인에서는 통과시키지 않는다. `faith.○/sr-1`이 정규 URL이어야 하고, 루트 도메인에서
 * 같은 글이 다른 주소로 또 열리면 그게 중복 URL이다.
 */
export function sitePrefixOf(pathname: string): SiteKey | null {
  const label = pathname.split("/")[1];
  return isSiteKey(label ?? null) ? (label as SiteKey) : null;
}

/**
 * 옛 주소를 제 지면으로 돌려보낸다 — `○/faith/sr-1` → `https://faith.○/sr-1`.
 *
 * 도메인이 붙기 전에는 지면이 경로였다(`○/faith/sr-1`). 그 주소가 이미 밖에 나가 있고,
 * 지금은 `/faith/faith/sr-1`로 리라이트돼 404다. 읽으러 온 사람에게 보여줄 화면이 아니다.
 *
 * **rewrite가 아니라 redirect다.** 같은 글이 두 주소로 열리면 그게 중복 URL이고, 이 파일이
 * `sitePrefixOf`에서 경계하는 바로 그것이다. 308은 "이제 저기가 그 글의 주소"라고 말한다.
 *
 * 지면 호스트가 설정된 경우에만 돈다 — 호스트가 하나인 환경에서 이게 돌면 로컬에서 세 면에
 * 들어갈 길이 사라진다(거기서는 경로가 곧 지면이다).
 *
 * 접두사와 같은 이름의 슬러그(`dev.○/faith`)는 이 규칙에 걸린다. 청구기호에서 나오는
 * 슬러그(`qt-0205`·`0504`)는 그렇게 생길 수 없고, 손으로 적는 기술 글 슬러그만 해당한다 —
 * 그 세 단어를 슬러그로 쓰지 않으면 된다.
 */
export function staleSiteRedirect(
  pathname: string,
  search: string,
  hosts: SiteHostConfig,
): string | null {
  const site = sitePrefixOf(pathname);
  if (!site) return null;

  const host = normalizeHost(site === "hub" ? hosts.root : hosts[site]);
  if (!host) return null;

  const rest = pathname.slice(`/${site}`.length);
  return `https://${host}${rest || "/"}${search}`;
}

/** 호스트 분기 결과를 실제 라우트 경로로 바꾼다. `/` → `/hub`, `/tags/x` → `/faith/tags/x` */
export function siteRewritePath(site: SiteKey, pathname: string): string {
  const suffix = pathname === "/" ? "" : pathname;
  return `/${site}${suffix}`;
}
