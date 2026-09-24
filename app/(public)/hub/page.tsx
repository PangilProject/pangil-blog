import { connection } from "next/server";
import { Suspense } from "react";

import { HubScene, HubStatement } from "@/components/hub/HubScene";
import { HubStage } from "@/components/hub/HubStage";
import { JsonLd } from "@/components/public/JsonLd";
import { RecordCard } from "@/components/record/RecordCard";
import { Tape } from "@/components/record/Tape";
import { countPublishedPosts } from "@/lib/db/publicLists";
import { publishHeatmap } from "@/lib/db/publishHeatmap";
import {
  currentStreak,
  heatLabel,
  heatLevel,
  longestStreak,
  monthSpans,
  toHeatmapCells,
} from "@/lib/record/heatmap";
import type { PublicSite } from "@/lib/revalidate/tags";
import { personJsonLd } from "@/lib/seo/jsonLd";
import {
  hubColophon,
  hubIntro,
  hubRecord,
  hubRoles,
  hubScenes,
  hubSentences,
  hubTools,
  hubWorks,
} from "@/lib/site/hubContent";
import { splitIntoGlyphs } from "@/lib/site/hubGlyphs";
import { siteAlternates } from "@/lib/site/metadata";
import { profileFromEnv } from "@/lib/site/profile";
import { siteHref } from "@/lib/site/publicUrl";

/**
 * H-01 프로필 허브 — 스크롤 연출 포트폴리오 (ADR-004 · 01 §3.3 개정).
 *
 * **이 파일은 1단계다: JS 없이 전부 읽히는 골격.** 2단계에서 아일랜드 하나(`HubStage`)가
 * 이 위에 연출을 얹지만, 여기서 멈춰도 지면은 완성돼 있어야 한다 — 이게 곧
 * `prefers-reduced-motion` 폴백이고, 04 §3.6이 요구하는 "JS 없이도 읽힌다"의 실현이다.
 *
 * 이전 판은 이름·소개·카드 둘이 전부였다. 그 판단은 M0~M6 내내 옳았지만
 * **"무엇을 보여주는가"를 답하지 않았다**(01 §3.3 개정 문단). 이력서에 적히는 주소에
 * 도착한 사람은 글이 아니라 사람을 보러 온 사람이다.
 *
 * 문구는 전부 `lib/site/hubContent`에 있다 — **고칠 곳이 하나여야 낡았는지 판단할 수 있다**
 * (프리모템 #11). 빈 배열이면 그 장면을 그리지 않는다.
 *
 * **지면은 프리렌더되고 장수만 요청 때 흘러든다.** 빌드가 DB에 의존해서는 안 된다 —
 * DB가 흔들리는 순간 배포가 막힌다. 실제로 CI가 그렇게 깨졌다.
 */
export const metadata = { alternates: siteAlternates("hub", "/hub") };

export default function HubPage() {
  const profile = profileFromEnv();
  // 허브는 블로그가 아니라 사람이다. 이름이 비어 있으면 아무것도 적지 않는다
  const person = personJsonLd();

  return (
    <main className="relative z-10 flex w-full flex-col">
      {person && <JsonLd data={person} />}
      {/* 연출 층 (ADR-004 2단계). 이 아일랜드가 없어도 아래는 전부 읽힌다 */}
      <HubStage />

      {/* ═══ 장면 하나 · 조판 ═══ */}
      <HubScene paper={hubScenes.compose.paper} slug={hubIntro.eyebrow} id="compose">
        <header className="flex flex-col">
          {profile.name && (
            <h1 className="font-serif font-bold text-[clamp(56px,15vw,132px)] leading-[1.04]">
              {/*
                이름이 한 자씩 찍힌다. **낱자는 서버가 그린다** — 스크립트로 하면 첫 페인트에
                이름이 보였다 사라지는 깜빡임이 생긴다. CSS가 순서대로 켜기만 한다.
              */}
              <span className="sr-only">{profile.name}</span>
              <span data-hub-type aria-hidden>
                {splitIntoGlyphs(profile.name).flatMap((word, wordIndex) =>
                  word.glyphs.map((glyph, glyphIndex) => (
                    <span
                      key={glyph.key}
                      data-hub-char
                      style={{ "--i": wordIndex * 4 + glyphIndex } as React.CSSProperties}
                    >
                      {glyph.char}
                    </span>
                  )),
                )}
              </span>
            </h1>
          )}
          <p className="mt-4 font-typewriter text-[clamp(11px,1.6vw,13px)] uppercase tracking-[0.32em] text-faint">
            {hubIntro.role}
          </p>
          <div
            aria-hidden
            data-hub-swipe
            style={{ "--chars": profile.name?.length ?? 3 } as React.CSSProperties}
            className="mt-6 h-0.5 bg-site-accent"
          />
          <p className="mt-6 flex flex-wrap items-baseline gap-3">
            <strong className="font-serif text-[clamp(17px,2.4vw,21px)]">{hubIntro.roleKo}</strong>
            <span className="font-typewriter text-[11.5px] text-faint">{hubIntro.stackLine}</span>
          </p>
        </header>

        {profile.tagline ? (
          <p className="mt-7 max-w-[46ch] whitespace-pre-line text-[15.5px] leading-body text-ink-soft">
            {profile.tagline}
          </p>
        ) : (
          <p className="mt-7 max-w-[46ch] text-[15.5px] leading-body text-ink-soft">
            {hubIntro.lede}
          </p>
        )}

        <p className="mt-9 font-typewriter text-[11px] text-faint">↓ {hubIntro.cue}</p>
      </HubScene>

      {/* ═══ 장면 둘 · 문장 ═══ */}
      {hubSentences.length > 0 && (
        <HubScene
          paper={hubScenes.sentence.paper}
          slug={hubScenes.sentence.slug}
          id="sentence"
          steps={hubSentences.length}
        >
          <div
            data-hub-steps="swap"
            style={{ "--steps-min": "clamp(170px, 26svh, 260px)" } as React.CSSProperties}
            className="flex flex-col gap-5"
          >
            {hubSentences.map((line, i) => (
              <p
                key={line}
                data-hub-step=""
                style={{ "--stagger-index": i } as React.CSSProperties}
                className="record-appear max-w-[19ch] text-balance font-serif font-bold text-[clamp(28px,5.6vw,62px)] leading-[1.28] tracking-[-0.02em]"
              >
                {/*
                  낱자를 **서버가 그린다.** 연출이 붙을 때 DOM을 다시 짜면 React가 관리하는
                  트리를 건드리게 된다 — 여기서 미리 쪼개 두면 연출은 스타일만 얹는다.
                  띄어쓰기에서 줄이 끊기도록 낱말로 한 겹 감싼다.
                */}
                {splitIntoGlyphs(line).map((word) => (
                  <span key={word.key} data-hub-word>
                    {word.glyphs.map((glyph) => (
                      <span key={glyph.key} data-hub-glyph>
                        {glyph.char}
                      </span>
                    ))}
                    {word.trailingSpace ? " " : ""}
                  </span>
                ))}
              </p>
            ))}
          </div>
          <HubTicks count={hubSentences.length} />
        </HubScene>
      )}

      {/* ═══ 장면 셋 · 역할 ═══ */}
      {hubRoles.length > 0 && (
        <HubScene
          paper={hubScenes.roles.paper}
          slug={hubScenes.roles.slug}
          id="roles"
          steps={hubRoles.length}
        >
          <HubStatement className="mb-9">
            화면을 만들 때 <span className="text-site-accent">여기에 시간을 씁니다</span>.
          </HubStatement>

          <dl
            data-hub-steps="swap"
            style={{ "--steps-min": "clamp(210px, 32svh, 320px)" } as React.CSSProperties}
            className="grid gap-x-10 gap-y-7 sm:grid-cols-2"
          >
            {hubRoles.map((role) => (
              <div key={role.word} data-hub-step="" className="flex flex-col gap-2">
                <dt className="font-serif font-bold text-[clamp(26px,4.4vw,44px)] text-site-accent">
                  {role.word}
                </dt>
                <dd className="max-w-[46ch] text-[14px] leading-body text-ink-soft">{role.body}</dd>
              </div>
            ))}
          </dl>
          <HubTicks count={hubRoles.length} />
        </HubScene>
      )}

      {/* ═══ 장면 넷 · 활자 ═══ */}
      {hubTools.length > 0 && (
        <HubScene
          paper={hubScenes.tools.paper}
          slug={hubScenes.tools.slug}
          id="tools"
          steps={hubTools.length}
          stepHeight={42}
        >
          <HubStatement className="mb-9">쓰고 있는 것만 적습니다.</HubStatement>

          {/*
            이름 자체가 큰 활자로 흘러간다. 로고를 늘어놓는 대신 활자를 쓰는 이유는
            이 지면이 조판에 대한 지면이기 때문이다. 스크롤이 위치를 정하고, 지금 읽고 있는
            항목이 액센트로 켜진다. 연출이 없으면 그냥 줄바꿈되는 낱말 목록이다.
          */}
          <div data-hub-marquee aria-hidden>
            {MARQUEE_ROWS.map((row) => (
              <div key={row} data-hub-mq-row>
                {/*
                  같은 벌을 두 번 넣는다. 두 벌이 **같은 구조**여야 -50%가 정확히 한 바퀴다 —
                  한쪽만 래퍼에 넣었더니 이동량이 어긋났다.
                */}
                <span data-hub-mq-set>
                  {hubTools.map((tool, index) => (
                    <span key={`${row}-${tool.name}`} data-hub-mq-item={index}>
                      {tool.name}
                    </span>
                  ))}
                </span>
                <span data-hub-mq-set data-hub-mq-dup>
                  {hubTools.map((tool, index) => (
                    <span key={`${row}-dup-${tool.name}`} data-hub-mq-item={index}>
                      {tool.name}
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>

          <div
            data-hub-steps="swap"
            style={{ "--steps-min": "clamp(120px, 18svh, 170px)" } as React.CSSProperties}
            className="mt-9 border-edge border-t pt-5"
          >
            {hubTools.map((tool) => (
              <div key={tool.name} data-hub-step="" className="flex flex-col gap-1.5">
                <p className="flex items-baseline gap-2.5">
                  <span className="font-serif font-bold text-[clamp(19px,3vw,26px)] text-site-accent">
                    {tool.name}
                  </span>
                  <span className="font-code text-[10.5px] text-faint">{tool.note}</span>
                </p>
                <p className="max-w-[56ch] text-[13.5px] leading-body text-ink-soft">{tool.body}</p>
              </div>
            ))}
          </div>
        </HubScene>
      )}

      {/* ═══ 장면 다섯 · 만든 것 ═══ */}
      {hubWorks.length > 0 && (
        <HubScene
          paper={hubScenes.works.paper}
          slug={hubScenes.works.slug}
          id="works"
          steps={hubWorks.length}
          stepHeight={100}
        >
          <HubStatement className="mb-9">
            무엇을 만들었는지보다 <span className="text-site-accent">무엇을 버렸는지</span>를
            적습니다.
          </HubStatement>

          <div
            data-hub-steps="swap"
            style={{ "--steps-min": "clamp(300px, 48svh, 460px)" } as React.CSSProperties}
            className="flex flex-col gap-px"
          >
            {hubWorks.map((work) => (
              <article key={work.call} data-hub-step="" className="py-7">
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
                  <div>
                    <p className="font-typewriter text-[10.5px] tracking-[0.14em] text-site-accent">
                      {work.call}
                    </p>
                    <h3 className="hub-work-title mt-1.5 font-serif font-bold text-[clamp(19px,3vw,25px)] leading-[1.5]">
                      {work.title}
                    </h3>
                    <p className="mt-1 font-typewriter text-[10.5px] text-faint">
                      {work.year} · {work.role}
                    </p>
                    <p className="hub-work-body mt-3 max-w-[60ch] text-[13.5px] leading-body text-ink-soft">
                      {work.body}
                    </p>
                    {/* 붉은 교정 주석 — 버린 것을 적는 자리 */}
                    <p className="hub-work-dropped mt-3.5 max-w-[56ch] border-accent-faith/55 border-l-2 pl-3.5 font-typewriter text-[11.5px] leading-[1.8] text-accent-faith">
                      {work.dropped}
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 self-start lg:pt-7">
                    <ul className="flex flex-wrap gap-1.5">
                      {work.stack.map((item) => (
                        <li
                          key={item}
                          className="border border-edge px-2 py-0.5 font-code text-[10.5px] text-ink-soft"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>

                    {/*
                      **없으면 그리지 않는다.** 눌러서 404가 나는 링크는 없는 것만 못하다.
                      새 창으로 여는 것은 이 지면이 목록이기 때문이다 — 하나 보고 돌아와
                      다음을 보게 된다.
                    */}
                    {(work.href || work.repo) && (
                      <p className="flex flex-wrap gap-3 font-typewriter text-[11px]">
                        {work.href && (
                          <a
                            href={work.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="border-site-accent border-b pb-0.5 text-site-accent hover:opacity-70"
                          >
                            바로가기 ↗
                          </a>
                        )}
                        {work.repo && (
                          <a
                            href={work.repo}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="border-edge-strong border-b pb-0.5 text-ink-soft hover:text-ink"
                          >
                            코드 보기 ↗
                          </a>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
          <HubTicks count={hubWorks.length} />
        </HubScene>
      )}

      {/* ═══ 장면 여섯 · 기록 ═══ */}
      <HubScene paper={hubScenes.record.paper} slug={hubScenes.record.slug} id="record">
        <HubStatement>{hubRecord.statement}</HubStatement>
        <p className="mt-3.5 max-w-[44ch] text-[14px] leading-body text-ink-soft">
          {hubRecord.lede}
        </p>

        {/* 숫자와 달력은 요청 시점에 흘러든다 — 빌드가 DB에 묶이면 배포가 막힌다 */}
        <div className="mt-8 flex flex-wrap gap-x-[clamp(28px,6vw,80px)] gap-y-6">
          <Suspense fallback={<TallyFallback />}>
            <Tally site="dev" label="개발의 기록 · 비정기" tone="var(--accent-dev)" />
          </Suspense>
          <Suspense fallback={<TallyFallback />}>
            <Tally site="faith" label="믿음의 기록 · 매일" tone="var(--accent-faith)" />
          </Suspense>
        </div>

        <div className="mt-9 flex flex-col gap-6">
          <Suspense fallback={<HeatFallback label="믿음의 기록 · 지난 1년" />}>
            <PublishCalendar
              site="faith"
              label="믿음의 기록 · 지난 1년"
              tone="var(--accent-faith)"
            />
          </Suspense>
          <Suspense fallback={<HeatFallback label="개발의 기록 · 지난 1년" />}>
            <PublishCalendar site="dev" label="개발의 기록 · 지난 1년" tone="var(--accent-dev)" />
          </Suspense>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          <RecordCard
            variant="dev"
            rotate={0.8}
            href={siteHref("dev", "/dev", { from: "hub" })}
            callNumber="DEV"
            aside="비정기"
            title="개발의 기록"
            subtitle="프론트엔드와 만드는 것들에 대해"
            meta="프론트엔드와 만드는 것들"
            overlay={<Tape className="rotate-2" />}
          >
            <p className="pt-3 font-typewriter text-[11px] text-(--card-accent)">읽으러 가기 →</p>
          </RecordCard>

          <RecordCard
            variant="faith"
            rotate={-1}
            href={siteHref("faith", "/faith", { from: "hub" })}
            callNumber="FAITH"
            aside="매일"
            title="믿음의 기록"
            subtitle="큐티 · 설교 · 찬양 묵상"
            meta="매일 쓰는 묵상"
            overlay={<Tape />}
          >
            <p className="pt-3 font-typewriter text-[11px] text-(--card-accent)">읽으러 가기 →</p>
          </RecordCard>
        </div>
      </HubScene>

      {/* ═══ 마지막 장 · 판권지 ═══ */}
      <HubScene paper={hubScenes.colophon.paper} slug={hubScenes.colophon.slug} id="colophon">
        <HubStatement>{hubColophon.statement}</HubStatement>
        <p className="mt-3.5 max-w-[58ch] text-[14px] leading-body text-ink-soft">
          {hubColophon.lede}
        </p>

        <dl className="mt-7 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
          {hubColophon.facts.map((fact) => (
            <div
              key={fact.label}
              className="flex gap-2.5 border-edge border-b py-2 font-typewriter text-[11.5px]"
            >
              <dt className="w-[76px] shrink-0 text-faint">{fact.label}</dt>
              <dd className="font-code text-[11px] text-ink-soft [overflow-wrap:anywhere]">
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
      </HubScene>
    </main>
  );
}

/**
 * 머무는 구간의 눈금. **화면이 멈춘 게 아니라 진행 중이라는 표시**다 —
 * 고정된 채 내용만 바뀌면 스크롤이 먹혔다고 오해하기 쉽다.
 *
 * 연출이 없으면 그려지지 않는다(globals.css). 읽는 데 필요한 정보가 아니라 상태 표시다.
 */
/** 눈금은 개수만 있으면 되므로 자리 번호를 키로 미리 만든다 — 순서가 바뀌지 않는 목록이다 */
function tickKeys(count: number): string[] {
  const keys: string[] = [];
  for (let i = 0; i < count; i += 1) keys.push(`tick-${i}`);
  return keys;
}

function HubTicks({ count }: { count: number }) {
  return (
    <div data-hub-ticks="" aria-hidden>
      {tickKeys(count).map((key) => (
        <span key={key} data-hub-tick="" />
      ))}
    </div>
  );
}

/** 마퀴 줄 수. 셋이면 화면이 차고, 넷부터는 글자가 아니라 무늬로 보인다 */
const MARQUEE_ROWS = ["a", "b", "c"];

/**
 * 통산 장수. `connection()`을 먼저 불러 **요청 시점**에만 DB를 만진다 — 그래야 빌드가 DB 없이
 * 끝나고, 숫자는 볼 때마다 최신이다(조회 자체는 캐시되고 발행 태그로 만료된다).
 *
 * **이 숫자는 손으로 세지 않는다.** 발행할 때마다 늘고, 시간이 지날수록 지면이 저절로
 * 갱신된다 — 프리모템 #11에 대한 답의 절반이 여기 있다(ADR-004).
 */
async function Tally({ site, label, tone }: { site: PublicSite; label: string; tone: string }) {
  await connection();

  const counts = await countPublishedPosts(site, new Date(0));

  return (
    <div className="flex flex-col" style={{ "--tone": tone } as React.CSSProperties}>
      <b
        data-hub-count={counts.total}
        className="font-serif font-bold text-[clamp(46px,9vw,92px)] text-(--tone) leading-[1.05] tabular-nums"
      >
        {counts.total.toLocaleString()}
      </b>
      <span className="mt-1.5 font-typewriter text-[11px] tracking-[0.12em] text-faint">
        {label}
      </span>
    </div>
  );
}

/**
 * 숫자가 오기 전의 자리.
 *
 * **투명하게 두지 않는다.** 아직 안 온 것과 아예 없는 것이 똑같아 보이면, 느린 회선에서는
 * 지면이 고장 난 것으로 읽힌다 — 폰에서 실제로 그렇게 보였다. 자리를 잡아 두면 숫자가
 * 도착할 때 조판이 튀지도 않는다.
 */
function TallyFallback() {
  return (
    <div className="flex flex-col" aria-hidden>
      <b className="font-serif font-bold text-[clamp(46px,9vw,92px)] text-faint/35 leading-[1.05]">
        ···
      </b>
      <span className="mt-1.5 font-typewriter text-[11px] text-faint/60">세는 중</span>
    </div>
  );
}

/**
 * 발행 달력. 하루가 칸 하나이고, 그날 쓴 장수만큼 진해진다.
 *
 * **빈 날을 감추지 않는다.** 채워진 날만 늘어놓으면 어떤 달력이든 빽빽해 보이고,
 * 그러면 이 그림이 아무것도 증명하지 않는다.
 */
async function PublishCalendar({
  site,
  label,
  tone,
}: {
  site: PublicSite;
  label: string;
  tone: string;
}) {
  await connection();

  const today = new Date();
  const cells = toHeatmapCells(await publishHeatmap(site, today), today);
  const longest = longestStreak(cells);
  const current = currentStreak(cells);
  const months = monthSpans(cells);

  return (
    <div style={{ "--heat": tone } as React.CSSProperties}>
      <p className="mb-1 font-typewriter text-[11px] tracking-[0.1em] text-faint">{label}</p>
      <div data-heat-scroll>
        <div data-heat role="img" aria-label={`${label}, 하루에 한 칸씩 ${cells.length}일`}>
          {cells.map((cell, index) => (
            <i
              key={cell.date}
              data-level={heatLevel(cell.count)}
              data-label={heatLabel(cell)}
              style={{ "--i": index } as React.CSSProperties}
            />
          ))}
        </div>
        <div data-heat-months aria-hidden>
          {months.map((span) => (
            <span key={span.key} style={{ "--weeks": span.weeks } as React.CSSProperties}>
              {span.label}
            </span>
          ))}
        </div>
      </div>
      <p data-streak>
        <span>
          이어 쓴 날 <b>{current}</b>일
        </span>
        <span>
          가장 길게 <b>{longest}</b>일
        </span>
        <span className="opacity-70">칸에 손을 올리면 그날이 나옵니다</span>
      </p>
    </div>
  );
}

/** 달력이 오기 전의 자리. 칸이 설 만큼 높이를 잡아 두어 도착할 때 지면이 밀리지 않게 한다 */
function HeatFallback({ label }: { label: string }) {
  return (
    <div aria-hidden>
      <p className="mb-1 font-typewriter text-[11px] tracking-[0.1em] text-faint">{label}</p>
      <div className="flex h-[112px] items-center font-typewriter text-[11px] text-faint/60">
        불러오는 중
      </div>
    </div>
  );
}
