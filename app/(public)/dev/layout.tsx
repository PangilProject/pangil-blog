import { SiteFooter } from "@/components/public/SiteFooter";
import { SiteSidebar } from "@/components/public/SiteSidebar";
import { StatBeacon } from "@/components/public/StatBeacon";
import { siteLayoutMetadata } from "@/lib/site/metadata";

/** D — 기술 블로그. data-site="dev"가 --accent를 잉크 블루로 바꾼다(03 §2.1). */
export const metadata = siteLayoutMetadata("dev");

export default function DevSiteLayout({ children }: LayoutProps<"/dev">) {
  return (
    // `group/site` — 상단 띠(사이드바)와 목차가 서로 다른 가지에 있어, 접힘을 주고받으려면
    // 여기가 공통 조상이어야 한다. 띠의 체크박스를 목차가 본다
    <div data-site="dev" className="group/site flex min-h-full flex-1 flex-col">
      {/*
        사이드바가 여기 서는 이유는 캐시다. 상세 지면은 통째로 `use cache`라 그 안에 두면
        방문자 수가 그 글의 캐시에 굳는다 — 레이아웃은 캐시 범위가 갈려서 요청 시점 조각을
        품을 수 있다. 덤으로 목록·상세·태그 목록이 같은 사이드바를 공유한다
      */}
      {/*
        **가운데 정렬된 통을 쓰지 않는다.** 전에는 사이드바까지 한 통(1240px)에 넣고 화면
        가운데 세웠는데, 넓은 모니터에서는 좌우가 660px씩 비고 글이 화면의 3분의 1만 썼다.
        사이드바는 화면 왼쪽 끝에 붙고, 본문 칸이 나머지 전부를 가져간다.

        폭 상한은 본문 칸 **안쪽**에 있다(1400px). 칸을 통째로 열어두면 넓은 화면에서
        카드가 한 줄에 여덟 장씩 서서 목록이 격자 벽이 된다
      */}
      <div className="flex w-full flex-1 flex-col lg:flex-row">
        <SiteSidebar site="dev" />

        <div className="min-w-0 flex-1 px-[6%] py-10 lg:px-10">
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </div>
      </div>

      <SiteFooter site="dev" />
      {/* UI가 없는 계측 아일랜드. 지면마다 놓지 않고 여기 한 번만 둔다(05 §4) */}
      <StatBeacon site="dev" />
    </div>
  );
}
