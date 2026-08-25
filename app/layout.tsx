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
  robots: { index: true, follow: true },
  // 호스트를 보고 지면별로 답한다(app/manifest.webmanifest/route.ts)
  manifest: "/manifest.webmanifest",
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
