import { type NextRequest, NextResponse } from "next/server";

import { resolveSite, siteHostsFromEnv, siteRewritePath } from "@/lib/site/resolveSite";

/**
 * 3호스트 분기 (04 §1.3):
 *   root      → /hub/*
 *   dev.*     → /dev/*
 *   faith.*   → /faith/*
 *   /admin/*  → 호스트 무관 (인증은 별도 가드가 담당)
 *
 * 개발 중에는 Vercel 기본 주소·로컬호스트에서 ?site= 쿼리로 3면을 전환한다(08 §3).
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 관리 영역은 루트 도메인 /admin 경로 하나로 고정이라 사이트 리라이트 대상이 아니다(02 §1).
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return NextResponse.next();
  }

  const site = resolveSite({
    host: request.headers.get("host"),
    siteParam: request.nextUrl.searchParams.get("site"),
    hosts: siteHostsFromEnv(process.env),
  });

  const url = request.nextUrl.clone();
  url.pathname = siteRewritePath(site, pathname);
  return NextResponse.rewrite(url);
}

export const config = {
  // _next 내부 자산, api 라우트, 정적 파일(확장자 있는 경로)은 건드리지 않는다.
  matcher: ["/((?!_next/|api/|.*\\.).*)"],
};
