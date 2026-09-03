/**
 * 관리 UI 힌트 쿠키 (A-03b).
 *
 * 공개 지면에 관리 컨트롤(`수정`·`지우기`)을 **보여줄지**만 정하는 값이다. 서버는 이 값을
 * 절대 신뢰하지 않는다 — 수정은 `/admin/edit/{slug}`가 세션을 확인하고, 삭제는 Server Action의
 * `withAdmin`이 막는다(05 §3.2). 즉 이 쿠키를 흉내 내면 **버튼이 보이기만** 한다.
 *
 * 왜 세션을 직접 보지 않는가: `getAdminUser()`는 Supabase Auth에 왕복한다. 공개 상세
 * 749편의 모든 요청에 외부 API 왕복을 붙일 수 없다 — 그래서 "공개 지면에서 세션을 확인하지
 * 않는다"가 통계 설계의 전제였다(05 §4.1 · 04 §1.2). 지면은 정적으로 남고, 판단은
 * 브라우저에서 한다.
 *
 * `stat_optout`을 재활용하지 않는 이유는 수명이 다르기 때문이다. 그쪽은 통계 제외가 목적이라
 * 로그아웃해도 남아야 하고, 그러면 로그아웃한 뒤에도 버튼이 보인다.
 *
 * httpOnly가 아니다(브라우저가 읽어야 한다). 값에 비밀이 없다 — 있는 것은 "이 브라우저가
 * 관리자로 /admin을 지났다"는 사실뿐이다.
 */
export const ADMIN_UI_COOKIE = "admin_ui";

/** 12시간. 하루 쓰는 도구이고, 남겨둘 이유가 없으면 스스로 사라지는 편이 낫다 */
export const ADMIN_UI_MAX_AGE = 60 * 60 * 12;

/** `document.cookie` 문자열에서 힌트를 찾는다. 브라우저에서 부른다 */
export function hasAdminUiHint(cookieString: string | undefined | null): boolean {
  if (!cookieString) return false;

  return cookieString.split(";").some((entry) => entry.trim().startsWith(`${ADMIN_UI_COOKIE}=1`));
}
