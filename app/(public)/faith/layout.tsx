import { StatBeacon } from "@/components/public/StatBeacon";

/** F — 묵상 블로그. --accent 기본값(인주 빨강)을 그대로 쓴다(03 §2.1). */
export default function FaithSiteLayout({ children }: LayoutProps<"/faith">) {
  return (
    <div data-site="faith" className="flex min-h-full flex-col">
      {children}
      {/* UI가 없는 계측 아일랜드. 지면마다 놓지 않고 여기 한 번만 둔다(05 §4) */}
      <StatBeacon site="faith" />
    </div>
  );
}
