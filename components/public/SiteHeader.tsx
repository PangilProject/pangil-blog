import Link from "next/link";

import { ThemeToggle } from "@/components/public/ThemeToggle";
import { editorPath } from "@/lib/record/todayCard";
import type { PublicSite } from "@/lib/revalidate/tags";
import { brandLabel } from "@/lib/site/brand";

/**
 * 공개 지면 상단 (프로토타입 `shead` · 02 §1).
 *
 * 브랜드 + 얇은 네비 하나. 읽는 사람이 목록으로 돌아갈 길과 구독(RSS), 그리고 밤낮 전환이
 * 여기 있다. 그 외에는 두지 않는다 — 지면의 주인은 글이다.
 *
 * `글쓰기`는 예외다(A-03b). 상세의 `수정`과 달리 **로그인 여부와 무관하게 보인다** — 그래서
 * 쿠키를 읽을 필요가 없고, 정적 링크 하나로 끝난다(클라이언트 JS 0). 세션이 없으면 proxy가
 * 로그인으로 보내고, 로그인 뒤에는 `next`를 따라 그 에디터로 도착한다.
 *
 * 가는 곳은 지면이 정한다: dev는 기술 에디터, faith는 **일단 QT**다. 세 종류를 고르는
 * 화면을 새로 만들지 않는다 — 설교·큐티·찬양을 하나로 합쳐 서식을 고르는 방향이 예정돼
 * 있어서(02 §5 미결), 임시 선택 화면은 그 통합에 버려질 코드다. 큐티가 가장 잦다.
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
        {/* nofollow인 이유는 색인이 아니라 예산이다 — 로봇이 모든 지면에서 이 링크를
            따라가면 그 요청이 전부 로그인 리다이렉트로 끝난다 */}
        <Link
          href={editorPath(site === "dev" ? "TECH" : "QT")}
          rel="nofollow"
          className="hover:text-ink"
        >
          글쓰기
        </Link>
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
