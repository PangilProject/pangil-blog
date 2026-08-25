import type { PublicSite } from "@/lib/revalidate/tags";
import { profileFromEnv } from "@/lib/site/profile";
import type { SiteKey } from "@/lib/site/resolveSite";

/**
 * 3면의 표시명·한 줄 소개 (08 §3).
 *
 * 표시명은 도메인과 별개인 **가칭**이고 출시 게이트에서 확정된다(07 §4). 그때 고칠 자리가
 * 하나여야 하는데, 지금은 셋이었다 — 헤더(`components/public/SiteHeader`), OG 카드 푸터
 * (`lib/db/publicPosts`의 siteLabel), 그리고 문서. 여기로 모은다.
 *
 * 허브는 사람의 이름이라 코드가 지어낼 수 없다 — `profileFromEnv`를 그대로 쓰고, 비어 있으면
 * 중립적인 "기록"으로 떨어진다(자리표시자를 그리지 않는다는 프로필 규칙과 같은 취지).
 */

/** 세 면이 공유하는 뒷글자. 헤더에서 액센트를 받는 그 두 글자다(03 §2.1) */
export const BRAND_MARK = "기록";

const BLOG_BRANDS = {
  faith: {
    lead: "믿음의 ",
    description: "말씀과 설교, 찬양을 하루 한 장씩 남기는 묵상 기록.",
  },
  dev: {
    lead: "개발의 ",
    description: "만들면서 배운 것을 한 장씩 남기는 기술 기록.",
  },
} as const satisfies Record<PublicSite, { lead: string; description: string }>;

/** 헤더가 쓰는 두 토막 — 뒷글자만 액센트를 받으므로 붙여 놓으면 안 된다 */
export function brandLabel(site: PublicSite): { lead: string; accent: string } {
  return { lead: BLOG_BRANDS[site].lead, accent: BRAND_MARK };
}

/** "믿음의 기록" — 제목·OG 카드 푸터처럼 한 덩어리로 쓰는 자리 */
export function blogBrandName(site: PublicSite): string {
  return `${BLOG_BRANDS[site].lead}${BRAND_MARK}`;
}

export type SiteBrand = {
  name: string;
  /** 없을 수 있다. 허브는 사람이 채우기 전까지 소개가 없다 */
  description: string | null;
};

/** 지면 하나의 표시명과 한 줄 소개. 허브만 env에서 온다 */
export function siteBrand(
  site: SiteKey,
  env: Record<string, string | undefined> = process.env,
): SiteBrand {
  if (site === "hub") {
    const profile = profileFromEnv(env);
    return {
      name: profile.name ?? BRAND_MARK,
      // 허브 소개는 여러 줄로 적힐 수 있다(지면은 그대로 그린다). 메타 설명은 한 줄이어야 한다
      description: profile.tagline?.replace(/\s*\n+\s*/g, " ").trim() || null,
    };
  }

  return { name: blogBrandName(site), description: BLOG_BRANDS[site].description };
}

/** 화면 번호 체계의 지면 코드 (02) — 카드에서 청구기호 자리에 선다 */
export const SITE_CODE: Record<SiteKey, string> = { hub: "H", faith: "F", dev: "D" };
