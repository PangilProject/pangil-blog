import { Suspense } from "react";

/**
 * 관리 영역 레이아웃.
 *
 * **껍데기는 즉시, 내용은 흘려보낸다.** 관리 화면은 모두 쿠키로 인증을 확인하므로(getAdminUser가
 * 첫 줄에서 `connection()`을 부른다) 내용은 요청이 있어야 나온다. 그 접근을 Suspense로 감싸지
 * 않으면 Next가 "이 이동은 즉시 반응하지 못한다"고 경고한다 — 실제로 개발 로그가 매 이동마다
 * 그 경고를 냈다.
 *
 * 레이아웃 자신은 데이터를 읽지 않는다. 그래야 이동한 순간 이 자리까지는 바로 그려진다.
 *
 * **`connection()`·`instant = false`를 여기 두지 않는다** — ADR-003 「영향」이 그렇게 적었지만
 * 2026-09-19에 재보니 둘 다 필요 없거나 듣지 않았다.
 *
 * - 레이아웃의 `instant`는 **리프로 내려가지 않는다**(넣고 빌드해도 세 면이 그대로 `static`).
 * - 리프에 넣어도 `compute`는 안 바뀐다. `instant = false`가 선언된 다른 화면들이 `resuming`인 것은
 *   그 선언 때문이 아니라 **읽는 것이 있어서**다.
 * - 세션도 데이터도 안 읽는 새 글쓰기 3면은 그래서 `static`인데, **그래도 안전하다.** 요청에 딸린
 *   값을 넣는 순간 Cache Components가 **빌드에서 거부한다** — 실제로 `new Date()`를 넣어 확인했다:
 *   `Next.js encountered the unstable value 'new Date()' while prerendering`. 조용히 옛 값이
 *   나가는 길이 없다.
 *
 * `connection()`을 부르면 위 문단의 "껍데기는 즉시"가 깨진다 — 얻을 것이 없으므로 부르지 않는다.
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <Suspense fallback={<div className="min-h-full bg-paper" />}>{children}</Suspense>;
}
