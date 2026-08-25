import type { Metadata } from "next";

import { fontVariables } from "@/app/fonts/fonts";
import { ThemeProvider } from "@/components/public/ThemeProvider";
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
