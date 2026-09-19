import Link from "next/link";
import { connection } from "next/server";
import { type ReactNode, Suspense } from "react";

import {
  closeLabel,
  FOLD_LEFT,
  FOLD_RIGHT,
  openLabel,
  PANEL_TOGGLE,
} from "@/components/public/panelToggle";
import { writeHref } from "@/components/public/SiteHeader";
import { ThemeToggle } from "@/components/public/ThemeToggle";
import { ViewCount } from "@/components/public/ViewCount";
import { countPublishedPosts, findAxisCounts, findFeedItems } from "@/lib/db/publicLists";
import type { PublicSite } from "@/lib/revalidate/tags";
import { brandLabel, siteBrand } from "@/lib/site/brand";
import { siteHref } from "@/lib/site/publicUrl";
import { cn } from "@/lib/utils";

/**
 * 띠에서 내려오는 판은 **한 번에 하나**다.
 *
 * 체크박스 둘로는 그게 안 된다 — 서로의 상태를 모르므로 목차와 분류가 같이 열린다. 라디오
 * 하나에 `없음`을 더한 세 값으로 두면 브라우저가 알아서 하나만 켜 준다. 다시 눌러 닫는 것은
 * 라디오가 못 하는 일이라, 손잡이마다 **라벨을 두 장** 둔다: 닫혀 있을 때 보이는 `열기`와
 * 열려 있을 때 그 자리에 겹쳐 서는 `닫기`(=`없음`을 고른다).
 *
 * 한 지면에 띠는 하나뿐이라 고정 id로 충분하다.
 */
const PANEL_NONE = "panel-none";
const PANEL_AXIS = "panel-axis";
const PANEL_TOC = "panel-toc";
const PANEL_NAME = "site-panel";

/**
 * 목록 옆 사이드바 (03 §5.1).
 *
 * 지면의 뼈대를 한 자리에 모은다: 이 블로그가 무엇인지, 얼마나 읽히는지, 어떤 분류가 있는지,
 * 방금 뭐가 올라왔는지. 이전에는 이 넷이 흩어져 있었다 — 분류는 목록 위 칸막이 탭에만 있어서
 * **상세에서 다른 분류로 가려면 목록을 거쳐야** 했고, 조회 수는 푸터라 끝까지 내려야 보였다.
 *
 * **칸막이 탭을 걷어내고 이 목록이 그 축을 가져간다.** 둘을 함께 두면 같은 분류 링크가 한
 * 화면에 두 벌이 되고, 글 수가 붙는 쪽과 안 붙는 쪽으로 갈린다.
 *
 * 레이아웃에 선다. 상세 지면은 통째로 캐시되므로(`use cache`) 그 안에 두면 방문자 수가 그
 * 글의 캐시에 굳는다 — 레이아웃은 페이지와 캐시 범위가 갈려서 요청 시점 조각을 품을 수 있다.
 *
 * **DB를 만지는 세 칸은 전부 Suspense 안이다.** 껍데기에서 조회하면 빌드가 DB에 의존하고,
 * 그 순간 DB가 흔들리면 배포가 막힌다 — 허브의 통산 장수가 같은 이유로 같은 모양이다.
 *
 * 모바일에서는 본문 위에 눕는다. 분류가 가로로 접히고 최근 글은 접히지 않고 빠진다 —
 * 좁은 화면에서 글에 닿기까지의 거리가 사이드바의 값어치보다 비싸다.
 */
export function SiteSidebar({ site }: { site: PublicSite }) {
  const label = brandLabel(site);
  const { description } = siteBrand(site);

  return (
    // 화면 왼쪽 끝에 붙는다. 바깥 여백은 이 칸 안쪽에만 있고, 오른쪽 괘선이 본문과 나눈다 —
    // 붙어 있는 칸이 화면 가운데 떠 있는 칸보다 "이 블로그의 것"으로 읽힌다
    <aside
      className={cn(
        "group/side w-full border-edge border-b bg-paper lg:w-[15rem] lg:flex-none lg:border-r lg:border-b-0",
        // 접히면 손잡이 하나 너비만 남기고, 남은 자리는 본문이 가져간다.
        // 폭을 숫자로 박지 않는 이유는 아래 여백과 같이 움직여야 해서다 — 손잡이가 제자리에
        // 있으려면 좌우 여백이 접히기 전과 같아야 하고, 그러면 폭은 내용이 정한다
        "lg:has-[#panel-axis:checked]:w-auto",
        /**
         * **좁은 화면에서는 이 칸이 상단에 붙는 줄이 된다.**
         *
         * sticky를 안쪽 줄에 걸 수 없다 — sticky는 부모 상자 안에서만 붙고, 접힌 사이드바는
         * 그 줄 높이밖에 안 돼서 곧바로 밀려 올라간다. aside 자신은 본문과 나란한 flex
         * 아이템이라 통이 화면만큼 길고, 그래서 여기 걸어야 스크롤 내내 남는다.
         */
        "max-lg:sticky max-lg:top-0 max-lg:z-30",
      )}
    >
      {/*
        이 칸이 화면 끝까지 서려면 레이아웃 쪽이 `flex-1`이어야 한다 — 없으면 짧은 글에서
        오른쪽 괘선이 본문 끝나는 자리에서 툭 끊긴다.

        sticky는 안쪽 div에 건다. aside 자체에 걸면 그 칸이 내용 높이만큼만 서서 오른쪽
        괘선이 본문 중간에서 끊긴다 — 목차가 같은 이유로 같은 모양이다(dev 상세)
      */}
      <div
        className={cn(
          "flex flex-col px-[6%] lg:sticky lg:top-0 lg:max-h-screen lg:overflow-y-auto lg:gap-7 lg:px-6 lg:py-10",
          // 펼친 사이드바가 화면보다 길면 여기서 스크롤한다 — 상단에 붙은 줄을 밀어내지 않는다
          "max-lg:max-h-screen max-lg:overflow-y-auto",
        )}
      >
        {/*
          머리 줄. 좁은 화면에서는 **브랜드와 손잡이가 한 줄**이고 그 줄이 곧 상단 띠다.
          넓은 화면에서는 예전처럼 손잡이가 위, 브랜드가 아래다(`flex-col-reverse`).
        */}
        <div
          className={cn(
            "flex h-10 items-center justify-between gap-3",
            "lg:h-auto lg:flex-col-reverse lg:items-start lg:gap-4",
          )}
        >
          <section className="flex flex-col gap-2 lg:group-has-[#panel-axis:checked]/side:hidden">
            <Link
              href={siteHref(site, `/${site}`, { from: site })}
              className="font-typewriter font-bold text-[13px] text-ink"
            >
              {label.lead}
              <em className="text-(--accent) not-italic">{label.accent}</em>
            </Link>
            {/* 설명문은 넓은 화면에서만 — 상단 띠는 한 줄이어야 띠다 */}
            {description && (
              <p className="max-lg:hidden text-[11.5px] leading-body text-faint">{description}</p>
            )}
          </section>

          {/* 좁은 화면에서는 이 줄이 유일한 띠라, 이 지면에서 할 수 있는 일이 다 선다 */}
          <div className="flex items-center gap-2">
            {/*
              `글쓰기`와 밝기는 넓은 화면에서 본문 위 줄(SiteHeader)에 있다. 좁은 화면에는
              그 줄이 없으므로 여기 선다 — 같은 것을 두 줄에 두면 글까지의 거리만 길어진다.

              토글이 문서에 두 벌 서지만 next-themes의 같은 문맥을 읽으므로 어긋나지 않고,
              한 번에 한쪽만 보인다.
            */}
            <span className="mr-1 flex items-center gap-3 font-typewriter text-[11px] text-faint lg:hidden">
              <Link href={writeHref(site)} rel="nofollow" className="hover:text-ink">
                글쓰기
              </Link>
              <ThemeToggle />
            </span>

            {/*
              **라디오 한 무리는 탭 한 칸이다.** 그래서 링도 무리에 건다.
              전에는 아무 데도 안 걸려 있었는데, Tab이 들어가는 지점은 기본으로 켜진
              `판 닫기` 라디오이고 그것이 `sr-only` 1×1px이라 **화면에 아무 표시가 없었다**.
              화살표를 누르면 판은 실제로 열렸다 — 거기까지 가는 길이 안 보였을 뿐이다.

              `role="radiogroup"`은 그 사실을 읽어 주는 쪽에도 말한다: 여기는 단추 둘이 아니라
              "어느 판을 열까"라는 고르는 자리 하나다.
            */}
            <div
              role="radiogroup"
              aria-label="띠에서 열 판"
              className={cn(
                "flex items-center gap-2",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4",
                "has-[:focus-visible]:outline-(--accent)",
              )}
            >
              <input
                id={PANEL_NONE}
                name={PANEL_NAME}
                type="radio"
                defaultChecked
                className="sr-only"
                aria-label="모두 닫기"
              />
              <TocHandle />
              <CollapseHandle />
            </div>
          </div>
        </div>

        {/*
          **같은 체크박스를 두 화면이 반대로 읽는다.**
          좁은 화면은 기본이 접힘(눌러야 펴짐), 넓은 화면은 기본이 펴짐(눌러야 접힘).
          체크박스는 "기본에서 벗어났나"만 들고 있고, 그 기본이 화면마다 다르다 — 폰에서는
          분류 아홉 줄을 지나야 글에 닿았고, 넓은 화면에서는 그 아홉 줄이 길잡이다.
        */}
        <div
          className={cn(
            "flex-col gap-7 pb-9 max-lg:pt-4",
            "hidden group-has-[#panel-axis:checked]/side:flex",
            "lg:flex lg:pb-0 lg:group-has-[#panel-axis:checked]/side:hidden",
          )}
        >
          <Suspense fallback={<CountSkeleton />}>
            <ViewCount />
          </Suspense>

          <Suspense fallback={null}>
            <AxisList site={site} />
          </Suspense>

          {/* 최근 글은 넓은 화면에서만. 모바일에서는 바로 아래가 그 목록이다 */}
          <Suspense fallback={null}>
            <RecentPosts site={site} />
          </Suspense>
        </div>
      </div>
    </aside>
  );
}

/**
 * 판 손잡이 — 열기 라벨과 닫기 라벨을 겹쳐 둔 한 벌.
 *
 * **자바스크립트를 쓰지 않는다.** 공개 지면의 클라이언트 아일랜드는 세어 둔 것이 전부고(04 §3.6),
 * "칸 하나 접기"에 그 예산을 쓰지 않는다. 라디오 세 값과 `group-has-*`면 끝이고, 스크립트가
 * 죽어도 열린다.
 *
 * 대신 **새로고침하면 닫힌다** — 열린 판을 기억하려면 쿠키가 필요하고, 쿠키를 읽으려면
 * 아일랜드가 는다. 지면 안에서 옮겨 다니는 동안은 레이아웃이 안 갈려서 그대로 남는다.
 */
function PanelHandle({
  target,
  name,
  openGlyph,
  closeGlyph,
  openWhenShut,
  shutWhenOpen,
  className,
}: {
  /** 이 손잡이가 켜는 라디오 */
  target: string;
  /**
   * 무엇을 여는 손잡이인가. **화면에는 안 적는다** — 같은 줄의 밝기 토글이 그림이라, 옆에
   * 글자 칩이 서면 한 줄에 두 문법이 섞이고 좁은 폭에서 브랜드가 눌린다.
   * 대신 `title`과 읽어 주는 이름으로 남는다.
   */
  name: string;
  /** 닫혀 있을 때 — 누르면 열린다 */
  openGlyph: ReactNode;
  /** 열려 있을 때 — 누르면 닫힌다 */
  closeGlyph: ReactNode;
  /**
   * 켜져 있는 판만 `닫기`를 내놓는다. 두 라벨이 같은 자리에 겹쳐 서므로 줄이 흔들리지 않는다.
   *
   * **이 두 줄을 부르는 쪽이 글자 그대로 넘긴다.** 여기서 `target`으로 조립하면 Tailwind가
   * 그 이름을 못 읽는다 — 클래스는 소스를 훑어 찾으므로, 만들어 낸 이름은 CSS에 안 나온다.
   * 화면에서는 그저 손잡이가 안 바뀌는 것으로 보이고, 조판 없는 테스트도 못 잡는다.
   */
  openWhenShut: string;
  shutWhenOpen: string;
  className?: string;
}) {
  const chip = cn(PANEL_TOGGLE, className);

  return (
    <>
      <input id={target} name={PANEL_NAME} type="radio" className="sr-only" />

      <label htmlFor={target} title={name} className={cn(chip, openWhenShut)}>
        {openGlyph}
        <span className="sr-only">{openLabel(name)}</span>
      </label>

      {/*
        좁은 화면에서 열려 있는 쪽은 잉크색으로 산다 — 그림만 있는 손잡이라 켜진 것이 달리
        드러나지 않는다. 넓은 화면에서는 칸이 접힌 것이 눈에 보이므로 색까지 쓰지 않는다.
      */}
      <label
        htmlFor={PANEL_NONE}
        title={name}
        className={cn(chip, shutWhenOpen, "max-lg:border-(--accent) max-lg:text-(--accent)")}
      >
        {closeGlyph}
        <span className="sr-only">{closeLabel(name)}</span>
      </label>
    </>
  );
}

/**
 * 기호는 **접히는 방향**을 가리키는데, 그 방향이 화면마다 다르다 — 좁은 화면에서는 이 칸이
 * 가로로 누워 아래로 펴지고, 넓은 화면에서는 옆으로 접힌다. 겹치는 display 유틸리티가 서로를
 * 지우지 않도록 바깥에서 한 번 갈라 둔다.
 */
function Glyph({ narrow, wide }: { narrow: ReactNode; wide: ReactNode }) {
  return (
    <span aria-hidden>
      <span className="lg:hidden">{narrow}</span>
      <span className="hidden lg:inline">{wide}</span>
    </span>
  );
}

/**
 * 차례 — 길이가 다른 네 줄. **글 안의 절**로 읽혀서 메뉴와 갈린다.
 *
 * 밝기 토글과 같은 결이다(ThemeToggle): 15px, 획 1.7, 둥근 끝. 같은 줄에 서는 그림들이
 * 굵기가 다르면 하나만 무거워 보인다.
 */
function TocIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      className="size-[15px]"
    >
      <path d="M4 6h16M4 11h11M4 16h14M4 21h8" />
    </svg>
  );
}

/** 메뉴 — 고른 길이의 세 줄. 분류를 연다 */
function MenuIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      className="size-[15px]"
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

/**
 * 분류 손잡이.
 *
 * **좁은 화면과 넓은 화면의 기본값이 반대다.** 폰에서는 분류 아홉 줄이 글로 가는 길을 막아
 * 기본이 닫힘이고, 넓은 화면에서는 그 아홉 줄이 길잡이라 기본이 펼침이다. 그래서 같은 라벨이
 * 한쪽에서는 `열기`, 다른 쪽에서는 `접기`로 읽힌다 — 기호만 갈라 둔다.
 *
 * 넓은 화면에서는 이 칸의 **바깥 가장자리**에 붙는다. 접히면 안쪽(본문 쪽) 모서리가 밀려
 * 들어오지만 바깥 모서리는 화면 끝에 못 박혀 있어, 그쪽에 두어야 제자리에 있는다.
 */
function CollapseHandle() {
  return (
    <PanelHandle
      target={PANEL_AXIS}
      name="분류"
      openGlyph={<Glyph narrow={<MenuIcon />} wide={FOLD_LEFT} />}
      closeGlyph={<Glyph narrow={<MenuIcon />} wide={FOLD_RIGHT} />}
      openWhenShut="group-has-[#panel-axis:checked]/side:hidden"
      shutWhenOpen="hidden group-has-[#panel-axis:checked]/side:inline-flex"
    />
  );
}

/**
 * 목차 손잡이 — 좁은 화면 전용.
 *
 * 넓은 화면에서는 상단 줄(SiteHeader)이 이 일을 한다. 좁은 화면에는 그 줄이 붙어 있지
 * 않으므로, 스크롤 내내 남는 유일한 띠인 여기가 맡는다.
 *
 * **목차가 있는 글에만 나온다.** 이 칸은 레이아웃에 있어서 지금 지면에 목차가 있는지 모른다
 * — 대신 목차가 남기는 표식(`data-toc`)을 보고 정한다. 제목이 하나뿐인 글에는 그 표식이
 * 없고, 그러면 이 손잡이도 없다.
 */
function TocHandle() {
  return (
    // 껍데기를 둘로 겹친다. 바깥은 화면 너비로, 안은 목차가 있는지로 가른다 —
    // 한 요소에 두 조건을 겹쳐 적으면 같은 display 유틸리티끼리 서로를 지운다
    <span className="lg:hidden">
      <span className="hidden items-center gap-2 group-has-[[data-toc]]/site:inline-flex">
        <PanelHandle
          target={PANEL_TOC}
          name="목차"
          openGlyph={<TocIcon />}
          closeGlyph={<TocIcon />}
          openWhenShut="group-has-[#panel-toc:checked]/side:hidden"
          shutWhenOpen="hidden group-has-[#panel-toc:checked]/side:inline-flex"
        />
      </span>
    </span>
  );
}

function SidebarHeading({ children }: { children: string }) {
  return <h2 className="font-typewriter text-[10px] tracking-[0.14em] text-faint">{children}</h2>;
}

/** 자리를 미리 잡아둔다 — 숫자가 흘러들 때 아래 목록이 밀리지 않게 */
function CountSkeleton() {
  return <div aria-hidden className="h-[38px]" />;
}

/**
 * 분류와 글 수. faith는 타입, dev는 카테고리다(lib/record/axis).
 *
 * 맨 위 `전체 글`은 지면 홈으로 간다 — 분류를 골랐다가 되돌아올 길이 목록 안에 있어야 한다.
 */
async function AxisList({ site }: { site: PublicSite }) {
  await connection();

  const [entries, counts] = await Promise.all([
    findAxisCounts(site),
    countPublishedPosts(site, new Date(0)),
  ]);

  return (
    <nav aria-label="분류" className="flex flex-col gap-2.5">
      <SidebarHeading>분류</SidebarHeading>

      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] lg:flex-col lg:gap-y-2">
        <li>
          <Link href={siteHref(site, `/${site}`, { from: site })} className="hover:text-(--accent)">
            전체 글 <Count value={counts.total} />
          </Link>
        </li>

        {entries.map((entry) => (
          <li key={entry.key}>
            <Link href={axisHref(site, entry.key)} className="hover:text-(--accent)">
              {entry.name} <Count value={entry.count} />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * 분류 하나로 가는 주소. **지면마다 파라미터 이름이 다르다** — faith는 타입, dev는 카테고리
 * 행이다(lib/record/axis). 여기가 어긋나면 링크는 멀쩡히 열리고 필터만 조용히 무시된다.
 */
export function axisHref(site: PublicSite, key: string): string {
  const path = site === "dev" ? `/dev?category=${key}` : `/faith?type=${key}`;
  return siteHref(site, path, { from: site });
}

/**
 * 최근 글 한 편으로 가는 주소.
 *
 * **떼어 둔 이유는 테스트다.** 이 링크는 `RecentPosts`(async 조각) 안에 있는데, jsdom은 그
 * 조각을 await하지 못해 **서스펜드된 지점에서 멈추고 껍데기만 보고 통과한다.** 즉 여기가
 * 깨져도 테스트는 초록이고 로컬도 멀쩡하며 **도메인이 붙은 프로덕션에서만 404다** —
 * 이 레포에서 실제로 한 번 일어난 고장의 모양 그대로다(전수조사 개발 1-11).
 *
 * 조각을 억지로 await시키는 대신 **주소 조립만 꺼내 고정한다.** 바로 위 `axisHref`가 같은 방식이다.
 */
export function recentPostHref(site: PublicSite, slug: string): string {
  return siteHref(site, `/${site}/${slug}`, { from: site });
}

function Count({ value }: { value: number }) {
  return <span className="font-typewriter text-[10.5px] text-faint">({value})</span>;
}

/** 최근 글 다섯. 피드가 쓰는 그 조회를 그대로 쓴다 — "최근"의 뜻이 갈리면 안 된다 */
async function RecentPosts({ site }: { site: PublicSite }) {
  await connection();

  const items = await findFeedItems(site, 5);
  if (items.length === 0) return null;

  return (
    <section className="hidden flex-col gap-2.5 lg:flex">
      <SidebarHeading>최근 글</SidebarHeading>

      <ul className="flex flex-col gap-2.5">
        {items.map((item) => (
          <li key={item.id}>
            <Link href={recentPostHref(site, item.slug)} className="flex flex-col gap-0.5 group">
              <span className="line-clamp-2 text-[12.5px] leading-[1.5] group-hover:text-(--accent)">
                {item.title}
              </span>
              {item.publishedAt && (
                <time className="font-typewriter text-[10px] text-faint">
                  {formatDay(item.publishedAt)}
                </time>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 사이드바의 날짜는 짧게 — 카드처럼 온전한 날짜를 적으면 제목보다 길어진다 */
function formatDay(at: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(at);
}
