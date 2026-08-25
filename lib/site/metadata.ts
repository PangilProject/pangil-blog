import type { Metadata } from "next";

import { siteBrand } from "@/lib/site/brand";
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

/** 지면 어디서나 같은 OG 공통 항목. 병합에 기대지 않고 손으로 편다 */
export function openGraphBase(site: SiteKey): { siteName: string; locale: string } {
  return { siteName: siteBrand(site).name, locale: "ko_KR" };
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
    },
    twitter: { card: "summary_large_image" },
  };
}
