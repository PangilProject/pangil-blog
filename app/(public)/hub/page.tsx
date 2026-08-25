import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { JsonLd } from "@/components/public/JsonLd";
import { RecordCard } from "@/components/record/RecordCard";
import { Tape } from "@/components/record/Tape";
import { countPublishedPosts } from "@/lib/db/publicLists";
import type { PublicSite } from "@/lib/revalidate/tags";
import { personJsonLd } from "@/lib/seo/jsonLd";
import { siteAlternates } from "@/lib/site/metadata";
import { profileFromEnv } from "@/lib/site/profile";

/**
 * H-01 프로필 허브 (01 §3.3 · 02 §2.1).
 *
 * **정적 한 페이지로 극소화한다**: 이름, 한 줄 소개, 두 블로그 카드, 링크. 끝.
 * 경력·프로젝트·이력서는 Backlog다 — "갱신할 게 없을 만큼 단순하면 낡지도 않는다"
 * (프리모템 #11).
 *
 * 카드 두 장이 각자의 액센트를 고정으로 쓴다(03 §2.1) — 허브에서 나란히 서기 때문이다.
 * 장수는 목록과 같은 조회를 쓴다: 여기가 두 블로그의 입구이므로, 얼마나 쌓였는지가 곧 소개다.
 *
 * **지면은 프리렌더되고 장수만 요청 때 흘러든다.** 01 §3.3이 "정적 한 페이지"로 못박았고,
 * 무엇보다 **빌드가 DB에 의존해서는 안 된다** — DB가 흔들리는 순간 배포가 막힌다. 실제로 CI가
 * 그렇게 깨졌다(빌드에는 더미 DB URL만 있다).
 */
export const metadata = { alternates: siteAlternates("hub", "/hub") };

export default function HubPage() {
  const profile = profileFromEnv();
  // 허브는 블로그가 아니라 사람이다. 이름이 비어 있으면 아무것도 적지 않는다
  const person = personJsonLd();

  return (
    <main className="mx-auto flex w-full max-w-[760px] flex-col gap-9 px-[6%] py-16">
      {person && <JsonLd data={person} />}

      <header className="flex flex-col gap-3">
        {profile.name && <h1 className="font-serif font-bold text-[26px]">{profile.name}</h1>}
        {profile.tagline && (
          <p className="whitespace-pre-line text-[14.5px] leading-body text-ink-soft">
            {profile.tagline}
          </p>
        )}
      </header>

      <div aria-hidden className="h-px bg-edge" />

      <div className="grid gap-5 sm:grid-cols-2">
        <RecordCard
          variant="faith"
          rotate={-1}
          href="/faith"
          callNumber="FAITH"
          aside="매일"
          title="믿음의 기록"
          subtitle="큐티 · 설교 · 찬양 묵상"
          meta={
            <Suspense fallback={<span className="opacity-0">통산 0장</span>}>
              <PostCount site="faith" />
            </Suspense>
          }
          overlay={<Tape />}
        >
          <p className="pt-3 font-typewriter text-[11px] text-(--card-accent)">읽으러 가기 →</p>
        </RecordCard>

        <RecordCard
          variant="dev"
          rotate={0.8}
          href="/dev"
          callNumber="DEV"
          aside="비정기"
          title="개발의 기록"
          subtitle="프론트엔드와 만드는 것들에 대해"
          meta={
            <Suspense fallback={<span className="opacity-0">통산 0장</span>}>
              <PostCount site="dev" />
            </Suspense>
          }
          overlay={<Tape className="rotate-2" />}
        >
          <p className="pt-3 font-typewriter text-[11px] text-(--card-accent)">읽으러 가기 →</p>
        </RecordCard>
      </div>

      <footer className="flex flex-wrap items-center gap-3 font-typewriter text-[11px] text-faint">
        {profile.links.map((link) => (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="border border-edge px-2.5 py-1 hover:text-ink"
          >
            {link.label}
          </a>
        ))}
        <Link href="/hub/privacy" className="ml-auto hover:text-ink">
          개인정보처리방침
        </Link>
      </footer>
    </main>
  );
}

/**
 * 통산 장수. `connection()`을 먼저 불러 **요청 시점**에만 DB를 만진다 — 그래야 빌드가 DB 없이
 * 끝나고, 숫자는 볼 때마다 최신이다(조회 자체는 캐시되고 발행 태그로 만료된다).
 */
async function PostCount({ site }: { site: PublicSite }) {
  await connection();

  const counts = await countPublishedPosts(site, new Date(0));
  return `통산 ${counts.total}장`;
}
