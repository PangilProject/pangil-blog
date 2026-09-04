import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { CrawlBand } from "@/components/editor/CrawlBand";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { SaveIndicator } from "@/components/editor/SaveIndicator";
import { SectionBlock } from "@/components/editor/SectionBlock";
import { AnnotationBox } from "@/components/record/AnnotationBox";
import { DividerTabs } from "@/components/record/DividerTabs";
import { GroupTab } from "@/components/record/GroupTab";
import { PostIt } from "@/components/record/PostIt";
import { Punch } from "@/components/record/Punch";
import { RecordCard } from "@/components/record/RecordCard";
import { ScriptureBlock } from "@/components/record/ScriptureBlock";
import { Stagger } from "@/components/record/Stagger";
import { StateStamp } from "@/components/record/StateStamp";
import { Tape } from "@/components/record/Tape";
import { Button } from "@/components/ui/button";
import { formatCallNumber } from "@/lib/record/callNumber";

/**
 * M1 확인 페이지 — 프로토타입(docs/record-system-prototype-v2.html)을 실제 컴포넌트로
 * 재현했는지 눈으로 대조하는 자리다(07 M1 DoD).
 *
 * 개발 전용이다. 프로덕션에서는 404 — 컴포넌트 갤러리는 배포 산출물이 아니다.
 *
 * 세그먼트 설정을 적지 않는다(ADR-003). 데이터를 읽지 않는 페이지는 Cache Components에서
 * 그대로 프리렌더된다.
 */

export default function DesignGalleryPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-14 px-6 py-12">
      <header className="flex flex-col gap-2">
        <p className="font-typewriter text-[11px] text-faint">M1 · 디자인 시스템 확인</p>
        <h1 className="font-serif text-2xl">기록 카드</h1>
        <p className="text-sm text-ink-soft">
          대조 기준은{" "}
          <code className="font-code text-[12px]">docs/record-system-prototype-v2.html</code>
          이다. 이 페이지는 개발 환경에서만 열린다.
        </p>
      </header>

      <Section
        title="토큰 · 3면 무드"
        note="사이트 오버라이드는 --accent 한 축뿐이다(프리모템 #12)"
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {(["faith", "dev", "hub"] as const).map((site) => (
            <div key={site} data-site={site} className="flex flex-col gap-3 border border-edge p-4">
              <p className="font-typewriter text-[10.5px] text-(--accent)">data-site={site}</p>
              <div className="h-1.5 bg-(--accent)" />
              <div className="flex flex-wrap gap-2">
                <Button size="sm">임시저장</Button>
                <Button size="sm" variant="primary">
                  발행
                </Button>
              </div>
              <GroupTab>내용관찰</GroupTab>
            </div>
          ))}
        </div>
        <Swatches />
      </Section>

      <Section title="타이포 역할" note="위계는 크기가 아니라 역할 교체로 만든다(03 §2.2)">
        <ul className="flex flex-col gap-2">
          <li className="font-sans text-[15px]">본문 · Pretendard — 오늘의 묵상을 적는다</li>
          <li className="font-serif text-[15px]">세리프 · Gowun Batang — 성별된 자리에만</li>
          <li className="font-typewriter text-[12px]">타자기 · Nanum Gothic Coding — QT-1043</li>
          <li className="font-code text-[13px]">코드 · JetBrains Mono — const record = true;</li>
        </ul>
      </Section>

      <Section title="기록 카드" note="목록 그리드 · 미세 회전 ±1도 · hover에서 집어 든다">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Stagger>
            <RecordCard
              variant="faith"
              rotate={-0.8}
              href="/faith"
              callNumber={formatCallNumber({ type: "QT", callNumber: 1043 })}
              aside="08.18"
              title="주님이 네 악을 네 머리로 돌려보내시리라"
              subtitle="열왕기상 2:41-46 — 하나님의 공의"
              meta="큐티 · 질문 여섯에 답하다"
            />
            <RecordCard
              variant="faith"
              rotate={0.6}
              href="/faith"
              callNumber={formatCallNumber({ type: "PRAISE", callNumber: 388 })}
              aside="08.17"
              title="마커스워십 - 주의 노래 가득해"
              subtitle="선포하라 주의 영광을"
              meta="찬양 · 가사와 기도"
            />
            <RecordCard
              variant="dev"
              rotate={-0.4}
              href="/dev"
              callNumber={formatCallNumber({ type: "TECH", callNumber: 72, categoryName: "회고" })}
              aside="08.16"
              title="티스토리를 떠나며"
              subtitle="2년간의 기록을 옮기는 일에 대해"
              meta="기술 · 회고"
            />
          </Stagger>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <RecordCard
            state="empty"
            variant="faith"
            title="이 칸은 아직 비어 있어요"
            meta="빈 필터"
          />
          <RecordCard variant="today" title="오늘의 QT" subtitle="초안이 도착했어요" meta="월~토">
            <Tape />
            <StateStamp kind="draft-arrived" />
            <Punch />
            <div className="h-6" />
          </RecordCard>
        </div>
      </Section>

      <Section title="칸막이 탭" note="목록 필터와 질문 그룹 헤더가 같은 언어를 쓴다(03 §3)">
        <DividerTabs
          label="묵상 타입 필터"
          items={[
            { label: "전체", href: "/faith", active: true },
            { label: "큐티", href: "/faith" },
            { label: "설교", href: "/faith" },
            { label: "찬양", href: "/faith" },
          ]}
        />
        <div className="flex gap-2">
          <GroupTab>연구와 묵상</GroupTab>
          <GroupTab>결단과 적용</GroupTab>
        </div>
      </Section>

      <Section title="묵상 조판" note="말씀은 세리프 + 행간 2.15, 주석은 점선 상자">
        <ScriptureBlock
          reference="열왕기상 2장 41~46절"
          verses={[
            {
              number: 41,
              text: "시므이가 예루살렘에서 가드로 갔다가 돌아온 것을 솔로몬에게 말한지라",
            },
            { number: 42, text: "왕이 사람을 보내어 시므이를 불러서 이르되" },
          ]}
        />
        <ScriptureBlock variant="sermon" reference="전도서 9장 7~10절">
          너는 가서 기쁨으로 네 음식물을 먹고 즐거운 마음으로 네 포도주를 마실지어다
        </ScriptureBlock>
        <AnnotationBox
          annotations={[
            {
              term: "송사를 듣고 분별하는 지혜",
              verseRef: "11절",
              body: "백성을 공의와 공평으로 다스릴 수 있는 능력을 뜻한다",
            },
            { term: "그 말씀이 주의 마음에 든지라", body: "직역하면 '주의 눈에 좋았다'를 의미함" },
          ]}
        />
      </Section>

      <Section title="에디터 셸" note="동작은 M2. 여기서는 표면과 상태 표현만">
        <div className="border border-edge bg-card">
          <EditorToolbar hint="마크다운 단축 입력도 돼요" />
          <div className="flex flex-wrap items-center gap-4 px-4 py-3">
            <SaveIndicator state="idle" />
            <SaveIndicator state="saving" />
            <SaveIndicator state="saved" savedAgo="방금" />
            <SaveIndicator state="offline-pending" variant="sermon" />
          </div>
          <div className="px-4 pb-4">
            <EditorToolbar variant="slim" className="static" />
          </div>
        </div>
        <CrawlBand fetchedAt="06:12" questionCount={6} annotationCount={1} />
        <CrawlBand variant="failed" />
        <div className="grid gap-3 sm:grid-cols-2">
          <SectionBlock label="Verse" ordinal={1} lyrics={"내 마음의 노래를\n주께 드리네"} />
          <SectionBlock label="Interlude" />
        </div>
      </Section>

      <Section title="상태 도장 · 메모지" note="크롤러 실패는 눈에 걸리게(프리모템 #1)">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {(["draft-arrived", "fresh-start", "done", "crawl-failed"] as const).map((kind) => (
            <RecordCard key={kind} variant="today" title=" " meta=" ">
              <StateStamp kind={kind} />
              <div className="h-8" />
            </RecordCard>
          ))}
        </div>
        <PostIt label="거슬림 목록">카드 hover 그림자가 조금 세다</PostIt>
      </Section>
    </main>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-3 border-edge border-b pb-2">
        <h2 className="font-serif text-lg">{title}</h2>
        {note && <p className="font-typewriter text-[10.5px] text-faint">{note}</p>}
      </div>
      {children}
    </section>
  );
}

const SWATCHES = [
  ["--paper", "bg-paper"],
  ["--card", "bg-card"],
  ["--ink", "bg-ink"],
  ["--ink-soft", "bg-ink-soft"],
  ["--faint", "bg-faint"],
  ["--accent-faith", "bg-accent-faith"],
  ["--accent-dev", "bg-accent-dev"],
  ["--ok", "bg-ok"],
  ["--warn", "bg-warn"],
  ["--line", "bg-line"],
  ["--edge", "bg-edge"],
  ["--postit", "bg-postit"],
  ["--crawl", "bg-crawl"],
] as const;

function Swatches() {
  return (
    <ul className="flex flex-wrap gap-3">
      {SWATCHES.map(([name, className]) => (
        <li key={name} className="flex w-[104px] flex-col gap-1">
          <span className={`h-10 border border-edge ${className}`} />
          <span className="font-typewriter text-[10px] text-faint">{name}</span>
        </li>
      ))}
    </ul>
  );
}
