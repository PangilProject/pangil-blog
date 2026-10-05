/**
 * 통계 레이아웃 — 글 하나의 추이를 띄울 자리(`modal`)를 목록 옆에 둔다.
 *
 * 목록에서 제목을 누르면 `@modal/(..)stats/[postId]`가 그 이동을 가로채 목록 위에 모달을 그린다.
 * 새로고침·직접 접속에서는 가로채지 않으므로 `[postId]` 페이지가 그려지고, 이 자리는
 * `@modal/default`(빈 것)로 채워진다 — default가 없으면 그 경우가 404다.
 *
 * **`(.)[postId]`가 아니라 `(..)stats/[postId]`다.** 같은 주소지만, 표시가 동적 세그먼트에 바로
 * 붙으면 Next 16.3이 가로챈 주소를 다시 풀 때 표시까지 값으로 읽어 `(.)(.)cmt…`를 만들고 500을
 * 낸다 — 브라우저는 그걸 받고 페이지 이동으로 넘어가서, 모달 대신 상세가 열렸다(2026-10-05).
 * 표시를 정적 세그먼트 앞에 붙이면(공식 예제 nextgram의 `(.)photos/[id]`와 같은 모양) 생기지 않는다.
 */
export default function AdminStatsLayout({ children, modal }: LayoutProps<"/admin/stats">) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
