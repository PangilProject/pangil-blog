import Link from "next/link";

import { ThemeToggle } from "@/components/public/ThemeToggle";
import { editorPath } from "@/lib/record/todayCard";
import type { PublicSite } from "@/lib/revalidate/tags";

/**
 * 공개 지면 상단 (프로토타입 `shead` · 02 §1).
 *
 * 얇은 네비 하나뿐이다. 그 외에는 두지 않는다 — 지면의 주인은 글이다.
 *
 * **브랜드는 여기 없다.** 사이드바가 지면 이름을 말하게 되면서 같은 이름이 한 화면에 두 벌
 * 찍혔다 — 사이드바 왼쪽 위와 본문 왼쪽 위, 나란한 높이에서. 지면의 정체는 사이드바가
 * 쥐고(SiteSidebar), 여기는 이 지면에서 **할 수 있는 일**만 남긴다.
 *
 * `목록`과 `RSS`는 뺐다(2026-09-05). 목록은 **브랜드를 누르면 가는 그 자리**여서 같은 링크가
 * 둘이었고, 구독은 한 번 하면 끝이라 글을 읽으러 온 사람의 눈길을 매번 나눠 가질 이유가
 * 없다 — 푸터로 내렸다(SiteFooter).
 *
 * `글쓰기`는 예외다(A-03b). 상세의 `수정`과 달리 **로그인 여부와 무관하게 보인다** — 그래서
 * 쿠키를 읽을 필요가 없고, 정적 링크 하나로 끝난다(클라이언트 JS 0). 세션이 없으면 proxy가
 * 로그인으로 보내고, 로그인 뒤에는 `next`를 따라 그 에디터로 도착한다.
 *
 * 가는 곳은 지면이 정한다: dev는 기술 에디터, faith는 묵상 글쓰기 하나다(02 §2.4) — 그
 * 화면이 요일과 오늘 몫 초안을 보고 서식을 고른다.
 */
export function SiteHeader({ site }: { site: PublicSite }) {
  return (
    <header className="flex flex-wrap items-center justify-end gap-3 border-edge border-b pb-3">
      <nav className="flex items-center gap-4 font-typewriter text-[11px] text-faint">
        {/* nofollow인 이유는 색인이 아니라 예산이다 — 로봇이 모든 지면에서 이 링크를
            따라가면 그 요청이 전부 로그인 리다이렉트로 끝난다 */}
        <Link
          href={site === "dev" ? editorPath("TECH") : "/admin/write/faith"}
          rel="nofollow"
          className="hover:text-ink"
        >
          글쓰기
        </Link>
        <ThemeToggle />
      </nav>
    </header>
  );
}
