import { type NextRequest, NextResponse } from "next/server";

import { ADMIN_LOGIN_PATH } from "@/lib/auth/adminPaths";
import { isAdminRequest } from "@/lib/auth/supabaseMiddleware";
import {
  isInternalPath,
  isPreviewHost,
  resolveSite,
  siteHostsFromEnv,
  sitePrefixOf,
  siteRewritePath,
} from "@/lib/site/resolveSite";

/**
 * 3호스트 분기 (04 §1.3):
 *   root      → /hub/*
 *   dev.*     → /dev/*
 *   faith.*   → /faith/*
 *   /admin/*  → 호스트 무관, 인증 체크 (미인증 → A-00 리다이렉트)
 *
 * 개발 중에는 Vercel 기본 주소·로컬호스트에서 ?site= 쿼리로 3면을 전환한다(08 §3).
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 3면 리라이트를 타지 않는 내부 경로(/admin, /design)는 먼저 걸러낸다.
  if (isInternalPath(pathname)) {
    const response = NextResponse.next();

    // 확인 페이지는 인증 대상이 아니다 — 프로덕션에서는 페이지 자체가 404다.
    if (pathname === ADMIN_LOGIN_PATH || !pathname.startsWith("/admin")) return response;

    const isAdmin = await isAdminRequest(request, response);
    if (isAdmin) return response;

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = ADMIN_LOGIN_PATH;
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  const host = request.headers.get("host");

  // 호스트가 하나인 환경(로컬·Vercel 기본 주소)에서는 이미 사이트 세그먼트로 시작하는 경로를
  // 그대로 통과시킨다. 리라이트를 또 걸면 `/faith/sr-1`이 `/hub/faith/sr-1`이 되어 404다
  if (isPreviewHost(host) && sitePrefixOf(pathname)) {
    return NextResponse.next();
  }

  const site = resolveSite({
    host,
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
