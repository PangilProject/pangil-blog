/**
 * 관리자 본인 방문 제외 (05 §4.1 · 07 M6 DoD "내 방문 제외 확인").
 *
 * **왜 쿠키 한 장인가.** 공개 지면은 통째로 캐시되고(ADR-003) 비콘도 그 캐시된 HTML에 실려
 * 나간다. 그래서 "관리자냐"를 서버가 지면에서 판단할 수 없다 — 판단하려면 공개 지면마다
 * Supabase 세션을 확인해야 하고, 그건 캐시를 버리는 것과 같다.
 *
 * 대신 관리 영역을 지날 때 **이미 알아낸 사실**을 쿠키에 적어 둔다(proxy가 `/admin`에서 세션을
 * 확인한다).
 * 그 뒤로는 비콘이 `document.cookie` 한 줄만 보고 조용히 입을 닫는다. 공개 지면에 추가 비용이
 * 0이고, 캐시를 건드리지 않는다.
 *
 * 이 쿠키에는 비밀이 없다 — 값은 `1` 하나다. 남이 이걸 심으면 자기 방문이 안 세어질 뿐이고,
 * 그건 공격이 아니라 옵트아웃이다. 그래서 httpOnly도 서명도 필요 없다(비콘이 읽어야 하므로
 * httpOnly면 애초에 동작하지 않는다).
 */

export const STAT_OPT_OUT_COOKIE = "stat_optout";

/** 1년. 관리자가 매달 로그인을 다시 하지 않아도 계속 빠져 있어야 한다 */
export const STAT_OPT_OUT_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * 3면이 서브도메인으로 갈리면(dev.○ / faith.○) 루트에서 심은 쿠키가 하위 지면에 보이지 않는다.
 * 그래서 루트 호스트가 설정돼 있으면 **부모 도메인에 심는다**. 미설정 단계에서는 3면이 한
 * 호스트를 공유하므로(Vercel 기본 주소) 호스트 한정으로 두면 된다.
 */
export function optOutCookieDomain(rootHost: string | undefined): string | undefined {
  if (!rootHost) return undefined;

  const host = rootHost.trim().toLowerCase().split(":")[0] ?? "";
  // 라벨이 둘 미만이면(localhost) 도메인 속성을 붙일 수 없다
  return host.split(".").length >= 2 ? `.${host}` : undefined;
}
