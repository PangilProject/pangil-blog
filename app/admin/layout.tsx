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
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <Suspense fallback={<div className="min-h-full bg-paper" />}>{children}</Suspense>;
}
