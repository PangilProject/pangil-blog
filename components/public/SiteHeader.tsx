import Link from "next/link";

import { FOLD_LEFT, FOLD_RIGHT, PANEL_TOGGLE } from "@/components/public/panelToggle";
import { ThemeToggle } from "@/components/public/ThemeToggle";
import { editorPath } from "@/lib/record/todayCard";
import type { PublicSite } from "@/lib/revalidate/tags";
import { cn } from "@/lib/utils";

/**
 * 이 지면에서 글을 쓰러 가는 자리. dev는 기술 에디터, faith는 묵상 글쓰기 하나다(02 §2.4).
 *
 * 좁은 화면에서는 상단 띠가 같은 링크를 내놓으므로 여기서 내보낸다 — 두 곳에 따로 적으면
 * 한쪽만 고쳐지고, 그때 한 화면의 두 `글쓰기`가 서로 다른 데로 간다.
 */
export function writeHref(site: PublicSite): string {
  return site === "dev" ? editorPath("TECH") : "/admin/write/faith";
}

/** 헤더의 손잡이와 목차 칸이 같은 이름을 봐야 한다 — 어긋나면 눌러도 아무 일이 없다 */
const TOC_FOLD_ID = "toc-fold";

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
 *
 * **목차 손잡이는 여기 선다**(`foldsToc`). 목차 칸 안에 두었을 때는 접고 펼 때마다 버튼이
 * 칸을 따라 움직였다 — 이 줄은 글 길이와 무관하게 늘 같은 자리에 있다. 기술 글에만 목차가
 * 있으므로 그 지면만 넘긴다. 없는 지면에 두면 눌러도 아무 일이 없는 버튼이 남는다.
 */
export function SiteHeader({ site, foldsToc = false }: { site: PublicSite; foldsToc?: boolean }) {
  return (
    // 좁은 화면에서는 이 줄이 없다. 스크롤 내내 남는 띠가 하나뿐이라 `글쓰기`와 밝기도
    // 거기 선다(SiteSidebar) — 같은 것을 두 줄에 두면 글까지의 거리만 길어진다
    <header className="max-lg:hidden flex flex-wrap items-center justify-end gap-3 border-edge border-b pb-3">
      <nav className="flex items-center gap-4 font-typewriter text-[11px] text-faint">
        {/* nofollow인 이유는 색인이 아니라 예산이다 — 로봇이 모든 지면에서 이 링크를
            따라가면 그 요청이 전부 로그인 리다이렉트로 끝난다 */}
        <Link href={writeHref(site)} rel="nofollow" className="hover:text-ink">
          글쓰기
        </Link>
        <ThemeToggle />
        {foldsToc && <TocFold />}
      </nav>
    </header>
  );
}

/**
 * 목차를 접는 손잡이.
 *
 * 사이드바와 같은 물건이다 — 숨긴 체크박스 하나, 자바스크립트 없음(04 §3.6). 다만 켜는 것이
 * 이 줄 밖에 있어서, 지면 라우트가 `main`에 `group/page`를 걸고 목차 칸이 그 그룹을 본다.
 * 선택자에 id를 적는 이유는 그 지면 어딘가에 다른 체크박스가 생겨도 목차가 같이 접히지
 * 않게 하려는 것이다.
 *
 * 좁은 화면에서는 숨는다. 거기서는 목차가 본문 위 접이식(`details`)이라 이 손잡이가 아무
 * 것도 하지 않는다.
 */
function TocFold() {
  return (
    <>
      <input id={TOC_FOLD_ID} type="checkbox" className="sr-only" />
      <label
        htmlFor={TOC_FOLD_ID}
        title="목차"
        className={cn(PANEL_TOGGLE, "hidden lg:inline-flex")}
      >
        <span aria-hidden className="group-has-[#toc-fold:checked]/page:hidden">
          {FOLD_RIGHT}
        </span>
        <span aria-hidden className="hidden group-has-[#toc-fold:checked]/page:inline">
          {FOLD_LEFT}
        </span>
        <span className="sr-only">목차 접고 펴기</span>
      </label>
    </>
  );
}
