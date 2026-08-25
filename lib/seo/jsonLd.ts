import { siteBrand } from "@/lib/site/brand";
import { profileFromEnv } from "@/lib/site/profile";
import { absoluteUrl, siteBaseUrl } from "@/lib/site/publicUrl";
import type { SiteKey } from "@/lib/site/resolveSite";

/**
 * 구조화 데이터 (07 M6 — "구조화 데이터·OG"에서 OG만 있었다).
 *
 * 검색 결과에 글쓴이와 날짜가 붙는 정도를 노린다. 개인 블로그이므로 조직이 아니라 사람이
 * 발행자다 — 허브 프로필 env가 그 사람이고, 비어 있으면 author를 아예 적지 않는다
 * (지어낸 이름을 구조화해 두는 것이 없는 것보다 나쁘다).
 *
 * URL은 OG와 같은 규칙을 따른다: 요청 헤더를 읽지 않고 env로만 정한다(ADR-003).
 */
type JsonLd = Record<string, unknown>;

const CONTEXT = { "@context": "https://schema.org" };
const LANG = "ko-KR";

function author(env: Record<string, string | undefined> = process.env): JsonLd | null {
  const profile = profileFromEnv(env);
  if (!profile.name) return null;

  return {
    "@type": "Person",
    name: profile.name,
    url: siteBaseUrl("hub", { host: null, env }),
    ...(profile.links.length > 0 ? { sameAs: profile.links.map((link) => link.href) } : {}),
  };
}

/** 지면 하나 = 블로그 하나. 목록·태그 지면이 단다 */
export function blogJsonLd(site: SiteKey, path: string): JsonLd {
  const brand = siteBrand(site);
  const person = author();

  return {
    ...CONTEXT,
    "@type": "Blog",
    name: brand.name,
    ...(brand.description ? { description: brand.description } : {}),
    url: absoluteUrl(site, path, { host: null }),
    inLanguage: LANG,
    ...(person ? { author: person, publisher: person } : {}),
  };
}

export type ArticleJsonLdInput = {
  site: SiteKey;
  title: string;
  description: string | null;
  path: string;
  publishedAt: Date | null;
  updatedAt: Date;
  imagePath: string;
  tags: string[];
};

export function articleJsonLd({
  site,
  title,
  description,
  path,
  publishedAt,
  updatedAt,
  imagePath,
  tags,
}: ArticleJsonLdInput): JsonLd {
  const person = author();
  const url = absoluteUrl(site, path, { host: null });

  return {
    ...CONTEXT,
    "@type": "BlogPosting",
    headline: title,
    ...(description ? { description } : {}),
    url,
    mainEntityOfPage: url,
    image: absoluteUrl(site, imagePath, { host: null }),
    ...(publishedAt ? { datePublished: publishedAt.toISOString() } : {}),
    dateModified: updatedAt.toISOString(),
    inLanguage: LANG,
    ...(tags.length > 0 ? { keywords: tags.join(", ") } : {}),
    ...(person ? { author: person, publisher: person } : {}),
    isPartOf: {
      "@type": "Blog",
      name: siteBrand(site).name,
      url: siteBaseUrl(site, { host: null }),
    },
  };
}

/** 허브는 블로그가 아니라 사람이다 (H-01) */
export function personJsonLd(): JsonLd | null {
  const person = author();
  if (!person) return null;

  const profile = profileFromEnv();
  return {
    ...CONTEXT,
    ...person,
    ...(profile.tagline ? { description: profile.tagline.replace(/\s*\n+\s*/g, " ").trim() } : {}),
  };
}
