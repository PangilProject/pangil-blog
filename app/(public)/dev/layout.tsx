import { SiteFooter } from "@/components/public/SiteFooter";
import { SiteSidebar } from "@/components/public/SiteSidebar";
import { StatBeacon } from "@/components/public/StatBeacon";
import { siteLayoutMetadata } from "@/lib/site/metadata";

/** D — 기술 블로그. data-site="dev"가 --accent를 잉크 블루로 바꾼다(03 §2.1). */
export const metadata = siteLayoutMetadata("dev");

export default function DevSiteLayout({ children }: LayoutProps<"/dev">) {
  return (
    <div data-site="dev" className="flex min-h-full flex-col">
      {/*
        사이드바가 여기 서는 이유는 캐시다. 상세 지면은 통째로 `use cache`라 그 안에 두면
        방문자 수가 그 글의 캐시에 굳는다 — 레이아웃은 캐시 범위가 갈려서 요청 시점 조각을
        품을 수 있다. 덤으로 목록·상세·태그 목록이 같은 사이드바를 공유한다
      */}
      <div className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col gap-8 px-[5%] py-10 lg:flex-row lg:items-start lg:gap-10">
        <SiteSidebar site="dev" />

        <div className="flex min-w-0 flex-1 flex-col gap-8">{children}</div>
      </div>

      <SiteFooter site="dev" />
      {/* UI가 없는 계측 아일랜드. 지면마다 놓지 않고 여기 한 번만 둔다(05 §4) */}
      <StatBeacon site="dev" />
    </div>
  );
}
