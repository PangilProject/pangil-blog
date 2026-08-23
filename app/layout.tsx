import type { Metadata } from "next";

import { fontVariables } from "@/app/fonts/fonts";

import "./globals.css";

// 브랜드 표시명·도메인은 배포 직전 확정(08 §3) — 하드코딩하지 않고 env로 주입한다.
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "기록",
  robots: { index: true, follow: true },
  // 지면별 피드다(app/(feeds)/rss.xml). 호스트가 지면을 가르므로 경로는 하나로 족하다
  alternates: { types: { "application/rss+xml": "/rss.xml" } },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${fontVariables} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
