/**
 * 허브에 적을 것 (H-01 · 01 §3.3).
 *
 * 이름·소개·링크는 사람의 것이라 코드가 지어낼 수 없다. env로 두고, **비어 있으면 그리지
 * 않는다** — 자리표시자가 남아 있는 프로필이 빈 프로필보다 나쁘다.
 *
 * 브랜드명은 출시 게이트다(07 §4). 그래서 기본값도 두지 않는다.
 */
export type Profile = {
  name: string | null;
  tagline: string | null;
  links: { label: string; href: string }[];
};

export function profileFromEnv(env: Record<string, string | undefined> = process.env): Profile {
  const links = [
    { label: "GitHub", href: env.NEXT_PUBLIC_GITHUB_URL },
    { label: "LinkedIn", href: env.NEXT_PUBLIC_LINKEDIN_URL },
  ];

  return {
    name: env.NEXT_PUBLIC_PROFILE_NAME?.trim() || null,
    tagline: env.NEXT_PUBLIC_PROFILE_TAGLINE?.trim() || null,
    links: links.filter((link): link is { label: string; href: string } => Boolean(link.href)),
  };
}
