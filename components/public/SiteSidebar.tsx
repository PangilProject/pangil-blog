import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { VisitorCount } from "@/components/public/VisitorCount";
import { countPublishedPosts, findAxisCounts, findFeedItems } from "@/lib/db/publicLists";
import type { PublicSite } from "@/lib/revalidate/tags";
import { brandLabel, siteBrand } from "@/lib/site/brand";
import { siteHref } from "@/lib/site/publicUrl";

/**
 * 목록 옆 사이드바 (03 §5.1).
 *
 * 지면의 뼈대를 한 자리에 모은다: 이 블로그가 무엇인지, 얼마나 읽히는지, 어떤 분류가 있는지,
 * 방금 뭐가 올라왔는지. 이전에는 이 넷이 흩어져 있었다 — 분류는 목록 위 칸막이 탭에만 있어서
 * **상세에서 다른 분류로 가려면 목록을 거쳐야** 했고, 방문자 수는 푸터라 끝까지 내려야 보였다.
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
    <aside className="w-full border-edge border-b lg:w-[15rem] lg:flex-none lg:border-r lg:border-b-0">
      {/*
        이 칸이 화면 끝까지 서려면 레이아웃 쪽이 `flex-1`이어야 한다 — 없으면 짧은 글에서
        오른쪽 괘선이 본문 끝나는 자리에서 툭 끊긴다.

        sticky는 안쪽 div에 건다. aside 자체에 걸면 그 칸이 내용 높이만큼만 서서 오른쪽
        괘선이 본문 중간에서 끊긴다 — 목차가 같은 이유로 같은 모양이다(dev 상세)
      */}
      <div className="flex flex-col gap-7 px-[6%] py-10 lg:sticky lg:top-0 lg:max-h-screen lg:overflow-y-auto lg:px-6">
        <section className="flex flex-col gap-2">
          <Link
            href={siteHref(site, `/${site}`, { from: site })}
            className="font-typewriter font-bold text-[13px] text-ink"
          >
            {label.lead}
            <em className="text-(--accent) not-italic">{label.accent}</em>
          </Link>
          {description && <p className="text-[11.5px] leading-body text-faint">{description}</p>}
        </section>

        <Suspense fallback={<VisitorSkeleton />}>
          <VisitorCount />
        </Suspense>

        <Suspense fallback={null}>
          <AxisList site={site} />
        </Suspense>

        {/* 최근 글은 넓은 화면에서만. 모바일에서는 바로 아래가 그 목록이다 */}
        <Suspense fallback={null}>
          <RecentPosts site={site} />
        </Suspense>
      </div>
    </aside>
  );
}

function SidebarHeading({ children }: { children: string }) {
  return <h2 className="font-typewriter text-[10px] tracking-[0.14em] text-faint">{children}</h2>;
}

/** 자리를 미리 잡아둔다 — 숫자가 흘러들 때 아래 목록이 밀리지 않게 */
function VisitorSkeleton() {
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
