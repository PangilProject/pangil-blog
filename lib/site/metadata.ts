import type { Metadata } from "next";

import { siteBrand } from "@/lib/site/brand";
import { absoluteUrl } from "@/lib/site/publicUrl";
import type { SiteKey } from "@/lib/site/resolveSite";

/**
 * 지면 하나의 기본 메타데이터 (04 §3.5의 연장 — 링크 공유가 곧 브랜딩이다).
 *
 * 세 면이 한 앱이라 루트 레이아웃에만 메타데이터를 두면 셋의 제목이 같아진다. 실제로 링크를
 * 공유하면 어느 면이든 "기록" 한 단어에 카카오톡 폴백 문구가 붙었다. 그래서 지면 레이아웃마다
 * 이 값을 깐다.
 *
 * **openGraph는 깊게 병합되지 않는다.** 글 상세처럼 아래에서 openGraph를 다시 쓰는 지면은
 * 부모 값을 통째로 덮으므로, 공통 항목은 `openGraphBase`를 펴서 직접 얹어야 한다.
 */

/**
 * OG 이미지 한 장. **절대 URL로 적는다** — metadataBase는 루트 도메인 하나뿐이라, 도메인이
 * 붙고 나면 dev 지면의 그림이 루트 호스트 주소로 적힌다. 그림은 제 지면 주소에 있어야 한다.
 *
 * host를 넘기지 않는 이유는 `generateMetadata`가 요청 헤더를 읽으면 지면 캐시가 깨지기
 * 때문이다(ADR-003). env만으로 답이 나온다 — 도메인이 있으면 그 호스트, 없으면 SITE_URL.
 */
export function ogImage(site: SiteKey, path: string, alt: string) {
  return [{ url: absoluteUrl(site, path, { host: null }), width: 1200, height: 630, alt }];
}

/** 지면 카드 — 글이 아닌 지면(목록·태그·허브)이 쓰는 기본 그림 */
export function siteOgImage(site: SiteKey) {
  return ogImage(site, `/api/og/site/${site}`, siteBrand(site).name);
}

/** 지면 어디서나 같은 OG 공통 항목. 병합에 기대지 않고 손으로 편다 */
export function openGraphBase(site: SiteKey): { siteName: string; locale: string } {
  return { siteName: siteBrand(site).name, locale: "ko_KR" };
}

/**
 * 정규 URL. 지면 호스트가 붙으면 `/dev` 세그먼트가 사라진다(`lib/site/publicUrl`).
 *
 * **레이아웃에는 두지 않는다.** alternates는 아래로 상속되므로, 레이아웃에서 한 번 적으면
 * 모든 글이 지면 홈을 정규 주소라고 말하게 된다. 지면마다 자기 주소를 적는다.
 *
 * RSS 링크를 함께 적는 이유는 병합이 얕기 때문이다 — canonical만 넣으면 루트가 깔아 둔
 * alternates가 통째로 밀려 피드 링크가 사라진다.
 */
export function siteAlternates(site: SiteKey, path: string): Metadata["alternates"] {
  return {
    canonical: absoluteUrl(site, path, { host: null }),
    types: { "application/rss+xml": "/rss.xml" },
  };
}

export function siteLayoutMetadata(site: SiteKey): Metadata {
  const brand = siteBrand(site);
  const description = brand.description ?? undefined;

  return {
    // default는 지면 홈, template은 그 아래 모든 글에 붙는다 — 글 제목만 넘기면 된다
    title: { default: brand.name, template: `%s · ${brand.name}` },
    description,
    openGraph: {
      ...openGraphBase(site),
      type: "website",
      title: brand.name,
      description,
      images: siteOgImage(site),
    },
    twitter: { card: "summary_large_image" },
  };
}
