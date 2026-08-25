import Link from "next/link";

import { ThemeToggle } from "@/components/public/ThemeToggle";
import type { PublicSite } from "@/lib/revalidate/tags";
import { brandLabel } from "@/lib/site/brand";

/**
 * 공개 지면 상단 (프로토타입 `shead` · 02 §1).
 *
 * 브랜드 + 얇은 네비 하나. 읽는 사람이 목록으로 돌아갈 길과 구독(RSS), 그리고 밤낮 전환이
 * 여기 있다. 그 외에는 두지 않는다 — 지면의 주인은 글이다.
 *
 * 브랜드의 뒷글자만 액센트를 받는다(프로토타입 `.brand em`). 지면에 따라 색이 갈리는 것이
 * `--accent` 1축 오버라이드의 눈에 보이는 결과다(03 §2.1). 표시명 자체는 `lib/site/brand`가
 * 쥐고 있다 — 헤더·OG 카드·메타데이터가 같은 이름을 말해야 한다.
 */
export function SiteHeader({ site }: { site: PublicSite }) {
  const label = brandLabel(site);
  const home = `/${site}`;

  return (
    <header className="flex flex-wrap items-baseline justify-between gap-3 border-edge border-b pb-3">
      <Link href={home} className="font-typewriter font-bold text-[14px] text-ink">
        {label.lead}
        <em className="text-(--accent) not-italic">{label.accent}</em>
      </Link>

      <nav className="flex items-center gap-4 font-typewriter text-[11px] text-faint">
        <Link href={home} className="hover:text-ink">
          목록
        </Link>
        <a href="/rss.xml" className="hover:text-ink">
          RSS
        </a>
        <ThemeToggle />
      </nav>
    </header>
  );
}
