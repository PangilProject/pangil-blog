import { SiteFooter } from "@/components/public/SiteFooter";
import { StatBeacon } from "@/components/public/StatBeacon";
import { siteLayoutMetadata } from "@/lib/site/metadata";

/**
 * H — 프로필 허브. 액센트는 faith와 공유하고, 카드 2장에서만 각자의 값을 쓴다(03 §2.1).
 *
 * 무드 오버라이드는 data-site 하나로 끝난다 — CSS가 --accent 한 축만 갈아끼운다.
 * 여기에 사이트별 변수를 더 얹지 않는다(프리모템 #12: 3면이 제각각 어긋나면
 * 하나 고치려고 셋을 고치게 된다).
 */
export const metadata = siteLayoutMetadata("hub");

export default function HubSiteLayout({ children }: LayoutProps<"/hub">) {
  return (
    <div data-site="hub" className="flex min-h-full flex-1 flex-col">
      <div className="flex-1">{children}</div>

      {/* 자기 푸터를 따로 그리고 있었다. 그쪽에만 다른 지면으로 가는 길이 없었다 */}
      <SiteFooter site="hub" />

      {/* UI가 없는 계측 아일랜드. 지면마다 놓지 않고 여기 한 번만 둔다(05 §4) */}
      <StatBeacon site="hub" />
    </div>
  );
}
