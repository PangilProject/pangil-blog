import { NotFoundNotice } from "@/components/public/NotFoundNotice";

/**
 * 이 지면의 없는 주소. 세그먼트에 두었으므로 **레이아웃 안에서** 그려진다 —
 * 헤더·사이드바·푸터는 그대로 남고 본문 칸만 바뀐다.
 *
 * 상태 코드는 proxy가 정한다. 캐시 라우트는 껍데기를 200으로 먼저 흘려보내 지면 안에서는
 * 상태를 바꿀 수 없다(Next의 Cache Components 제약) — proxy.ts 참조.
 */
export default function DevNotFound() {
  return <NotFoundNotice site="dev" />;
}
