import { AdminFooter } from "@/components/admin/AdminFooter";

/**
 * 에디터 화면들의 푸터 자리.
 *
 * 에디터는 클라이언트 컴포넌트라 그 안에서는 푸터의 저작권 줄(요청 시점에 연도를 읽는 서버 조각)을
 * 그릴 수 없다. 그래서 에디터 셸 밖, 이 레이아웃에서 붙인다 — 새 글·이어쓰기 경로가 모두 여기를 지난다.
 */
export default function AdminWriteLayout({ children }: LayoutProps<"/admin/write">) {
  return (
    <>
      {children}
      <AdminFooter />
    </>
  );
}
