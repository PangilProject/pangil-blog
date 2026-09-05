import type { Metadata, Viewport } from "next";

import { fontVariables } from "@/app/fonts/fonts";
import { ThemeProvider } from "@/components/public/ThemeProvider";
import { THEME_COLOR } from "@/lib/og/palette";
import { BRAND_MARK } from "@/lib/site/brand";

import "./globals.css";

// 브랜드 표시명·도메인은 배포 직전 확정(08 §3) — 하드코딩하지 않고 env로 주입한다.
//
// 여기에는 **세 면에 공통인 것만** 둔다. 제목·설명·OG는 지면 레이아웃이 각자 깐다
// (`lib/site/metadata`) — 셋이 한 앱이라 여기서 정하면 세 면의 링크 미리보기가 같아진다.
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: BRAND_MARK,
  /**
   * `robots: index, follow`를 적지 않는다. 그건 로봇의 기본값이라 적어도 얻는 것이 없는데,
   * **없는 주소 화면에서는 해가 된다** — 그 화면에는 Next가 `noindex`를 붙이므로 한 문서에
   * 상반된 지시가 둘 남는다. 색인하지 말아야 할 지면은 각자 `robots`를 깐다
   * (개인정보처리방침·검색 결과·없는 주소).
   */
  // 호스트를 보고 지면별로 답한다(app/manifest.webmanifest/route.ts)
  manifest: "/manifest.webmanifest",
  /**
   * iOS 16.4 미만은 매니페스트의 `display`를 읽지 않는다 — 홈 화면에 담아도 브라우저 막대가
   * 함께 뜬다. 이 낡은 신호가 그 기기에서 앱처럼 열리게 하는 유일한 방법이다.
   *
   * `statusBarStyle`은 기본값을 쓴다. `black-translucent`는 내용이 상태 바 아래로 올라와
   * 지면 조판을 다시 봐야 한다.
   */
  appleWebApp: { capable: true, title: BRAND_MARK, statusBarStyle: "default" },
  // 지면별 피드다(app/(feeds)/rss.xml). 호스트가 지면을 가르므로 경로는 하나로 족하다
  alternates: { types: { "application/rss+xml": "/rss.xml" } },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: 테마 클래스는 첫 페인트 전 인라인 스크립트가 심는다(04 §3.6)
    <html lang="ko" suppressHydrationWarning className={`${fontVariables} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

/**
 * 주소창 색은 지면 배경을 따라간다 — 스크롤 끝에서 브라우저 크롬과 종이가 이어지도록.
 * 다크 토글(next-themes)은 이 값을 바꾸지 못하므로 OS 설정 기준 두 벌을 준다.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLOR.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLOR.dark },
  ],
};
