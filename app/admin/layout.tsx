// 관리 영역은 인증이 필요하고 항상 최신이어야 하므로 캐시하지 않는다(04 §1.1).
export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return children;
}
