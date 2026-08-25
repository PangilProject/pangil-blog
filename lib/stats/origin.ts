import { isPreviewHost, normalizeHost, type SiteHostConfig } from "@/lib/site/resolveSite";

/**
 * Origin 필터 (05 §4.1) — "자사 호스트가 아니면 드롭".
 *
 * 브라우저는 cross-origin POST에 Origin 헤더를 반드시 붙인다. 그래서 이 검사 하나로 남의
 * 페이지에 심어진 스크립트가 내 통계를 채우는 일을 막는다. curl은 Origin을 안 붙이므로
 * **Origin 부재도 드롭**이다 — 사람의 브라우저에서 온 비콘은 언제나 이 헤더를 갖는다.
 *
 * 도메인은 아직 미확정이라(07 §4 출시 게이트) 호스트를 코드에 적지 않고 env에서 받는다.
 * env가 비어 있는 개발·프리뷰에서는 localhost와 `*.vercel.app`을 허용한다.
 */
export function isAllowedOrigin(origin: string | null, hosts: SiteHostConfig): boolean {
  if (!origin) return false;

  let host: string;
  try {
    host = normalizeHost(new URL(origin).host);
  } catch {
    return false; // Origin이 URL이 아니면 브라우저가 보낸 것이 아니다
  }
  if (!host) return false;

  const configured = [hosts.root, hosts.dev, hosts.faith]
    .map(normalizeHost)
    .filter((value) => value.length > 0);

  if (configured.includes(host)) return true;

  // 도메인 미설정 단계에서는 프리뷰 호스트가 곧 자사 호스트다
  return configured.length === 0 && isPreviewHost(host);
}
