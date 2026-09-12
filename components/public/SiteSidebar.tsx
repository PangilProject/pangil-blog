import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import {
  FOLD_DOWN,
  FOLD_LEFT,
  FOLD_RIGHT,
  FOLD_UP,
  PANEL_TOGGLE,
} from "@/components/public/panelToggle";
import { ViewCount } from "@/components/public/ViewCount";
import { countPublishedPosts, findAxisCounts, findFeedItems } from "@/lib/db/publicLists";
import type { PublicSite } from "@/lib/revalidate/tags";
import { brandLabel, siteBrand } from "@/lib/site/brand";
import { siteHref } from "@/lib/site/publicUrl";
import { cn } from "@/lib/utils";

/** 한 지면에 사이드바는 하나뿐이라 고정 id로 충분하다 */
const COLLAPSE_ID = "sidebar-collapse";

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
        "lg:has-checked:w-auto",
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
          <section className="flex flex-col gap-2 lg:group-has-checked/side:hidden">
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

          <CollapseHandle />
        </div>

        {/*
          **같은 체크박스를 두 화면이 반대로 읽는다.**
          좁은 화면은 기본이 접힘(눌러야 펴짐), 넓은 화면은 기본이 펴짐(눌러야 접힘).
          체크박스는 "기본에서 벗어났나"만 들고 있고, 그 기본이 화면마다 다르다 — 폰에서는
          분류 아홉 줄을 지나야 글에 닿았고, 넓은 화면에서는 그 아홉 줄이 길잡이다.
        */}
        <div
          className={cn(
            "flex-col gap-7 pb-9",
            "hidden group-has-checked/side:flex",
            "lg:flex lg:pb-0 lg:group-has-checked/side:hidden",
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
 * 접는 손잡이.
 *
 * **자바스크립트를 쓰지 않는다.** 공개 지면의 클라이언트 아일랜드는 세어 둔 것이 전부고(04 §3.6),
 * "칸 하나 접기"에 그 예산을 쓰지 않는다. 숨긴 체크박스 하나와 `group-has-checked`면 끝이고,
 * 스크립트가 죽어도 접힌다.
 *
 * 대신 **새로고침하면 다시 펴진다** — 접힌 상태를 기억하려면 쿠키가 필요하고, 쿠키를 읽으려면
 * 아일랜드가 는다. 지면 안에서 옮겨 다니는 동안은 레이아웃이 안 갈리므로 접힌 채로 남는다.
 */
function CollapseHandle() {
  return (
    <>
      <input id={COLLAPSE_ID} type="checkbox" className="sr-only" />
      {/*
        **바깥 가장자리에 붙는다.** 접히면 이 칸은 안쪽(본문 쪽) 모서리가 밀려 들어오지만
        바깥 모서리는 화면 끝에 못 박혀 있다 — 손잡이를 그쪽에 두어야 접고 펴는 동안
        제자리에 있는다. 오른쪽 여백의 목차가 오른쪽 끝에 붙어 있는 것과 같은 규칙이다.
      */}
      <label htmlFor={COLLAPSE_ID} title="사이드바" className={cn(PANEL_TOGGLE, "lg:self-start")}>
        {/*
          기호는 **접히는 방향**을 가리키는데, 그 방향이 화면마다 다르다 — 좁은 화면에서는
          이 칸이 가로로 누워 아래로 펴지고, 넓은 화면에서는 옆으로 접힌다.
          겹치는 display 유틸리티가 서로를 지우지 않도록 바깥에서 한 번 갈라 둔다.
        */}
        <span aria-hidden className="lg:hidden">
          <span className="group-has-checked/side:hidden">{FOLD_DOWN}</span>
          <span className="hidden group-has-checked/side:inline">{FOLD_UP}</span>
        </span>
        <span aria-hidden className="hidden lg:inline">
          <span className="group-has-checked/side:hidden">{FOLD_LEFT}</span>
          <span className="hidden group-has-checked/side:inline">{FOLD_RIGHT}</span>
        </span>
        <span className="sr-only">사이드바 접고 펴기</span>
      </label>
    </>
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
            <Link
              href={siteHref(site, `/${site}/${item.slug}`, { from: site })}
              className="flex flex-col gap-0.5 group"
            >
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
