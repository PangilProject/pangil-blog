import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { ThemeToggle } from "@/components/public/ThemeToggle";
import type { PublicSite } from "@/lib/revalidate/tags";
import { blogBrandName } from "@/lib/site/brand";
import { profileFromEnv } from "@/lib/site/profile";
import { siteHref } from "@/lib/site/publicUrl";
import type { SiteKey } from "@/lib/site/resolveSite";

/**
 * 공개 지면 푸터 (03 §5.1).
 *
 * 헤더는 읽는 사람이 **글로 들어가는 길**이고, 푸터는 **글에서 나가는 길**이다. 그래서
 * 구독(RSS)·다른 지면·방침처럼 자주 쓰지 않지만 있어야 하는 것을 여기 모은다 — 헤더에
 * 두면 글을 읽으러 온 사람의 눈길을 매번 나눠 가진다.
 *
 * **세 면이 같은 푸터를 쓴다.** 소개 지면은 자기 푸터를 따로 그리고 있었는데, 그쪽에만
 * 다른 지면으로 가는 길이 없었다 — 두 벌이면 반드시 한쪽이 낡는다.
 *
 * **연도는 시계에서 읽는다.** 해가 바뀔 때 사람이 고쳐야 하는 숫자를 화면에 박아두지
 * 않는다 — 고치는 것을 잊는 것이 기본값이기 때문이다.
 *
 * 다만 시계는 **요청이 있어야** 읽을 수 있다. 프리렌더는 재현 가능한 출력만 허용하므로
 * (ADR-003) `new Date()`가 껍데기에서 불리면 빌드가 거부한다 — 실제로 그렇게 깨졌다.
 * 그래서 연도만 Suspense 안의 조각으로 떼어 요청 시점에 흘려보낸다.
 *
 * 조회 수는 여기 없다. 사이드바로 올렸다(ViewCount) — 매일 보게 되는 숫자가 지면
 * 맨 끝에 있을 이유가 없다.
 *
 * 지면 이름은 브랜드에서 온다(lib/site/brand). 도메인·표시명이 출시 게이트에서 확정되면
 * 그 한 곳만 바뀐다(07 §4).
 */
export function SiteFooter({ site }: { site: SiteKey }) {
  const { name, links } = profileFromEnv();

  return (
    <footer className="flex w-full flex-col gap-3 border-edge border-t px-[6%] py-8 font-typewriter text-[11px] text-faint lg:px-10">
      <nav aria-label="다른 지면과 구독" className="flex flex-wrap items-center gap-4">
        {crossLinks(site).map((link) => (
          <Link key={link.href} href={link.href} className="hover:text-ink">
            {link.label}
          </Link>
        ))}

        {/* 헤더에서 내려온 자리다. 구독은 한 번 하면 끝이라 눈에 늘 띌 이유가 없다 */}
        <a href="/rss.xml" className="hover:text-ink">
          RSS
        </a>

        {links.map((link) => (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-ink"
          >
            {link.label}
          </a>
        ))}

        <Link
          href={siteHref("hub", "/hub/privacy", { from: site })}
          className="ml-auto hover:text-ink"
        >
          개인정보처리방침
        </Link>

        {/*
          **소개 지면에서도 밝기를 바꿀 수 있어야 한다.** 토글이 `SiteHeader`와 `SiteSidebar`에만
          있어서 허브에는 아예 없었다 — 이력서에 적히는 주소가 거기다(02 §2.1). 푸터는 세 면이
          함께 쓰므로 한 자리면 끝난다.

          아일랜드 **종류는 늘지 않는다**. 이미 세고 있는 토글 하나가 한 군데 더 서는 것이고,
          좁은/넓은 화면에 두 벌 서는 것을 04 §3.6이 같은 근거로 이미 허용했다.

          **선택이 세 면에 따라오게 하지는 않는다.** 프로덕션의 3면은 서로 다른 오리진이고,
          맞추려면 쿠키를 첫 페인트 전에 읽어야 해서 지면 캐시와 부딪친다(전수조사 디자인 2-2 ②).

          소개 지면에서만 그린다. 푸터는 셋이 함께 쓰는데 dev·faith에는 이미 위쪽에 토글이 있어서,
          여기 두면 한 화면에 두 개가 선다.
        */}
        {site === "hub" && <ThemeToggle />}
      </nav>

      {/* 이름이 없으면 그리지 않는다 — 자리표시자가 남은 프로필이 빈 프로필보다 나쁘다 */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[10.5px]">
        <p>
          <Suspense fallback={<span className="opacity-0">© 0000</span>}>
            <Copyright name={name} />
          </Suspense>
        </p>
        <p>{USE_NOTICE}</p>
      </div>
    </footer>
  );
}

/**
 * 권리 한 줄. 법적 효력이 있는 문장이 아니라 **부탁**이다 — 1인 블로그에서 "무단 전재 및
 * 재배포를 금합니다"는 지킬 수단도 지킬 사람도 없는 말이고, 이 지면의 어조도 아니다(03 §7.1).
 */
const USE_NOTICE = "글과 사진을 가져갈 때는 출처를 남겨 주세요.";

/**
 * 다른 지면으로 건너가는 길. 지금 서 있는 곳은 빼고 나머지를 놓는다 —
 * 자기 자신으로 가는 링크는 누를 이유가 없는 자리만 차지한다.
 *
 * `/hub`를 화면에서 **소개**라고 부른다. `허브`는 라우트의 이름이지 읽는 사람의 말이
 * 아니다(03 §7.2) — 그 지면에 있는 것은 이름·한 줄 소개·링크, 즉 소개다.
 */
function crossLinks(site: SiteKey): { href: string; label: string }[] {
  const blogs: PublicSite[] = ["faith", "dev"];

  return [
    ...blogs
      .filter((blog) => blog !== site)
      .map((blog) => ({
        href: siteHref(blog, `/${blog}`, { from: site }),
        label: blogBrandName(blog),
      })),
    ...(site === "hub" ? [] : [{ href: siteHref("hub", "/hub", { from: site }), label: "소개" }]),
  ];
}

/**
 * 저작권 한 줄. 조립을 순수 함수로 떼어낸 이유는 **테스트가 이 줄을 볼 수 있어야** 해서다 —
 * async 서버 컴포넌트는 jsdom에서 await되지 않아 트리가 비어버린다(PraiseView 테스트와 같은
 * 사정). 이름이 없으면 연도만 남는다.
 */
export function copyrightLine(year: number, name: string | null): string {
  return `© ${year}${name ? ` ${name}` : ""}`;
}

/** 연도는 요청 시점에 읽는다 — 프리렌더에서는 시계를 볼 수 없다(ADR-003) */
async function Copyright({ name }: { name: string | null }) {
  await connection();

  return copyrightLine(new Date().getFullYear(), name);
}
