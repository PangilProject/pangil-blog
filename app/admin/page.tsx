import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminNav } from "@/components/admin/AdminNav";
import { CrawlButton } from "@/components/admin/CrawlButton";
import { NitList } from "@/components/admin/NitList";
import { TodayCard } from "@/components/admin/TodayCard";
import { ADMIN_LOGIN_PATH } from "@/lib/auth/adminPaths";
import { getAdminUser } from "@/lib/auth/adminSession";
import { countOpenNits, listOpenNits } from "@/lib/db/nits";
import { listDrafts } from "@/lib/db/posts";
import { findTodayCrawl, findTodayPosts, findWritingPace } from "@/lib/db/today";
import { crawlTriggerState } from "@/lib/record/crawlTrigger";
import { formatKstDay, isSunday } from "@/lib/record/kst";
import { formatRelativeTime } from "@/lib/record/relativeTime";
import {
  editorPath,
  RECORD_TYPE_LABELS,
  todayCardState,
  todayCardTypes,
} from "@/lib/record/todayCard";

/**
 * A-01 대시보드 (02 §2.4 · §3.1) — "서비스의 심장. 오늘 쓸 글로 1탭 진입".
 *
 * 세 가지가 있다: ① 오늘의 작성 카드(요일 기반 상태 기계) ② 크롤러 상태 배지 + 수동 폴백
 * ③ 작성 중 초안 바로가기. 그 외에는 아무것도 두지 않는다 — 아침에 여는 화면이 복잡하면
 * 그게 곧 작성 마찰이다.
 *
 * M6에서 ④ 거슬림 목록(03 §3 · 프리모템 #3)이 **맨 끝에** 붙었다. 위쪽 질서는 그대로다 —
 * 개선 욕구를 적을 곳이 없으면 그 욕구가 코드로 가고(프리모템 #10), 그건 작성 시간을 먹는다.
 *
 * 카드 회전은 ±1도 안에서 흩뿌린다(03 §5.1). 매번 다르면 화면이 흔들려 보이므로 고정값이다.
 */

/** 크롤러 상태 문구 (02 §2.4 ②). M4 이전에는 실행 기록이 없다 */
const CRAWL_LABELS = {
  SUCCESS: "정상",
  FAILED: "실패",
  SKIPPED: "큐티 없는 날",
} as const;

export default async function AdminDashboardPage() {
  // middleware가 이미 막지만, 서버에서 한 번 더 확인한다(05 §3.2 이중 가드).
  const user = await getAdminUser();
  if (!user) redirect(ADMIN_LOGIN_PATH);

  const now = new Date();
  const types = todayCardTypes(now);

  const [todayPosts, crawl, drafts, nits, nitTotal, pace] = await Promise.all([
    findTodayPosts(types, now),
    findTodayCrawl(now),
    listDrafts(6),
    listOpenNits(),
    countOpenNits(),
    findWritingPace(now),
  ]);

  const cardPostIds = new Set([...todayPosts.values()].map((post) => post.id));
  const otherDrafts = drafts.filter((draft) => !cardPostIds.has(draft.id));

  return (
    <div className="flex min-h-full flex-col bg-paper">
      <AdminNav />

      <main className="mx-auto flex w-full max-w-[760px] flex-col gap-7 px-[5%] py-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-serif text-lg">{formatKstDay(now)}, 오늘의 기록</h1>
          {/* 상태와 그 상태에서 할 수 있는 일을 나란히 둔다 — "못 가져왔어요" 다음에
              해야 하는 일이 레포를 열어 워크플로우를 찾는 것이면 그건 답이 아니다 */}
          <div className="flex items-center gap-2.5 font-typewriter text-[11px] text-faint">
            <p>
              {/* QT는 크롤러가 채운다(06 §2). 일요일엔 크롤이 없으므로 배지도 없다 */}
              {isSunday(now) ? (
                "설교 · 찬양의 날"
              ) : crawl ? (
                <>
                  크롤러 <b className="text-ink">{CRAWL_LABELS[crawl.status]}</b>
                </>
              ) : (
                "아직 오늘 큐티를 못 가져왔어요"
              )}
            </p>

            <CrawlButton state={crawlTriggerState(now, crawl)} />
          </div>
        </div>

        {/*
          **얼마나 쓰고 있나** (00 §4.1 ①작성 마찰).

          이 화면은 "오늘 뭘 쓸까"만 말하고 있었다. 그래서 **떨어지고 있다는 사실이 화면 밖에
          있었다** — 9월 어느 주엔 엿새가 비었는데 매일 여는 자리에는 그 사실이 없었고,
          같은 기간 기술 글은 계속 올라갔다. 못 쓰는 것이 아니라 안 보이는 것이었다.

          **숫자 둘이 전부다.** 스트릭·그래프·배지는 만들지 않는다 — 게이미피케이션은 이미
          내려진 결정이고(07 §3-3), 아침에 여는 화면이 복잡해지면 그게 곧 작성 마찰이다.
        */}
        <WritingPaceLine daysThisWeek={pace.daysThisWeek} postsThisMonth={pace.postsThisMonth} />

        <section className="grid gap-4 sm:grid-cols-2">
          {types.map((type, index) => {
            const post = todayPosts.get(type) ?? null;
            const typeCrawl = type === "QT" ? crawl : null;

            return (
              <TodayCard
                key={type}
                type={type}
                state={todayCardState({ post, crawl: typeCrawl })}
                post={post}
                savedAgo={post ? formatRelativeTime(post.updatedAt, now) : null}
                rotate={index === 0 ? -0.8 : 0.7}
              />
            );
          })}
        </section>

        <section className="flex flex-wrap gap-2">
          {/* 오늘 카드에 없는 타입은 상시 보조 버튼이다 (02 §3.1 "상시") */}
          {!isSunday(now) && <Plate href={editorPath("SERMON")}>설교 쓰기</Plate>}
          <Plate href={editorPath("TECH")}>새 기술 글</Plate>
        </section>

        {otherDrafts.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="font-typewriter text-[10.5px] tracking-[0.14em] text-faint">
              작성 중인 초안
            </h2>
            <ul className="flex flex-col divide-y divide-edge border border-edge bg-card">
              {otherDrafts.map((draft) => (
                <li key={draft.id}>
                  <Link
                    href={editorPath(draft.type, draft.id)}
                    className="flex flex-wrap items-baseline gap-3 px-4 py-2.5 hover:bg-paper"
                  >
                    <span className="font-typewriter text-[10.5px] text-faint">
                      {RECORD_TYPE_LABELS[draft.type]}
                    </span>
                    <span className="flex-1 text-[13.5px]">{draft.title || "제목 없음"}</span>
                    <span className="font-typewriter text-[10.5px] text-faint">
                      {formatRelativeTime(draft.updatedAt, now)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 맨 끝이다 — 아침에 여는 화면의 위쪽은 오늘 쓸 글의 자리다(02 §3.1) */}
        <NitList nits={nits} total={nitTotal} />
      </main>
    </div>
  );
}

/**
 * 이번 주 며칠 썼나 · 이번 달 몇 장인가.
 *
 * **날을 세지 장수를 세지 않는다.** 매일 몫이라는 기대치에 답하는 숫자는 "며칠 썼나"이고,
 * 하루에 세 편을 몰아 써도 그날은 하루다.
 *
 * 칭찬도 꾸중도 하지 않는다 — 숫자만 둔다. 적은 날에 "아쉬워요"가 뜨면 그건 아침에 여는
 * 화면이 나를 평가하는 것이고, 그 마찰이 이 도구가 없애려던 바로 그것이다.
 */
function WritingPaceLine({
  daysThisWeek,
  postsThisMonth,
}: {
  daysThisWeek: number;
  postsThisMonth: number;
}) {
  return (
    <p className="font-typewriter text-[11.5px] text-faint">
      이번 주 <b className="text-ink">{daysThisWeek}/7</b>
      <span className="px-2">·</span>
      이번 달 <b className="text-ink">{postsThisMonth}장</b>
    </p>
  );
}

function Plate({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="border border-edge bg-card px-3.5 py-2 font-typewriter text-[11.5px] text-ink shadow-card transition-transform duration-200 ease-record hover:-translate-y-[2px]"
    >
      {children}
    </Link>
  );
}
