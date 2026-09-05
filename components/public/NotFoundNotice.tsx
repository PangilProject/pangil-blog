import Link from "next/link";

import type { PublicSite } from "@/lib/revalidate/tags";
import { blogBrandName } from "@/lib/site/brand";

/**
 * 없는 주소 안내 (03 §5 · §7).
 *
 * Next의 기본 화면은 영문 한 줄(`This page could not be found`)이고 이 지면의 어조도 조판도
 * 아니다. 한국어로 쓰는 블로그에서 그건 "여기서 뭔가 잘못됐다"로만 읽힌다.
 *
 * **주소가 바뀌었을 수 있다는 말을 적는다.** 2026-09-05에 글 주소를 통째로 개편해서
 * (05 §6.4) 옛 링크 천여 개가 여기로 온다 — 실제로 가장 흔한 도착 이유이므로 감추지 않는다.
 *
 * 지면 안에 놓이면 헤더·사이드바·푸터는 그대로 남고 **본문 칸만** 이 안내로 바뀐다. 읽던
 * 사람이 길을 잃는 것이 아니라 그 글만 없는 것이므로, 나머지 길은 그대로 있어야 한다.
 */
export function NotFoundNotice({ site }: { site?: PublicSite }) {
  return (
    <main className="flex w-full flex-col gap-5 py-16">
      <p className="font-typewriter text-[11px] tracking-[0.14em] text-faint">404</p>

      <h1 className="font-serif font-bold text-[22px]">이 주소에는 글이 없어요</h1>

      <p className="text-[14px] leading-body text-ink-soft">
        주소가 바뀌었을 수 있어요. 목록에서 다시 찾아주세요.
      </p>

      <nav aria-label="목록으로" className="flex flex-wrap gap-3 pt-2 font-typewriter text-[11px]">
        {/* 지금 서 있는 지면이 먼저다 — 그 목록이 이 사람이 찾던 글에 가장 가깝다 */}
        {(site ? [site, other(site)] : (["faith", "dev"] as PublicSite[])).map((target) => (
          <Link
            key={target}
            href={`/${target}`}
            className="border border-edge px-2.5 py-1 text-faint hover:text-ink"
          >
            {blogBrandName(target)}
          </Link>
        ))}
      </nav>
    </main>
  );
}

function other(site: PublicSite): PublicSite {
  return site === "dev" ? "faith" : "dev";
}
