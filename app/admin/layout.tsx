import { connection } from "next/server";

/**
 * 관리 영역 레이아웃.
 *
 * Cache Components(ADR-003)에서는 `dynamic = "force-dynamic"`을 쓸 수 없다. 대신 이 영역은
 * **프리렌더하지 않는다**는 사실을 두 줄로 명시한다.
 *
 * - `connection()`: 이 서브트리는 요청이 있어야 렌더된다. 관리 화면은 전부 인증 결과에 따라
 *   갈리고, 에디터는 Tiptap이 렌더 중 난수를 써서 빌드 시점에 그릴 수 없다(프리렌더는 재현
 *   가능한 출력만 허용한다)
 * - `instant = false`: 미리 그릴 껍데기가 없으므로 블로킹 라우트로 둔다. Suspense 자리를
 *   만드는 건 로그인 여부를 모른 채 관리 화면 틀을 보여주는 셈이다
 *
 * 공개 지면에서는 반대로 캐시가 기본이 된다.
 */
export const instant = false;

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await connection();

  return children;
}
