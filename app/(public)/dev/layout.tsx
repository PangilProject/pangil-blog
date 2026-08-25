import { StatBeacon } from "@/components/public/StatBeacon";
import { siteLayoutMetadata } from "@/lib/site/metadata";

/** D — 기술 블로그. data-site="dev"가 --accent를 잉크 블루로 바꾼다(03 §2.1). */
export const metadata = siteLayoutMetadata("dev");

export default function DevSiteLayout({ children }: LayoutProps<"/dev">) {
  return (
    <div data-site="dev" className="flex min-h-full flex-col">
      {children}
      {/* UI가 없는 계측 아일랜드. 지면마다 놓지 않고 여기 한 번만 둔다(05 §4) */}
      <StatBeacon site="dev" />
    </div>
  );
}
