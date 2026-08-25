import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminNav } from "@/components/admin/AdminNav";
import { NitList } from "@/components/admin/NitList";
import { TodayCard } from "@/components/admin/TodayCard";
import { ADMIN_LOGIN_PATH } from "@/lib/auth/adminPaths";
import { getAdminUser } from "@/lib/auth/adminSession";
import { countOpenNits, listOpenNits } from "@/lib/db/nits";
import { listDrafts } from "@/lib/db/posts";
import { findTodayCrawl, findTodayPosts } from "@/lib/db/today";
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
  SKIPPED: "콘텐츠 없는 날",
} as const;

export default async function AdminDashboardPage() {
  // middleware가 이미 막지만, 서버에서 한 번 더 확인한다(05 §3.2 이중 가드).
  const user = await getAdminUser();
  if (!user) redirect(ADMIN_LOGIN_PATH);

  const now = new Date();
  const types = todayCardTypes(now);

  const [todayPosts, crawl, drafts, nits, nitTotal] = await Promise.all([
    findTodayPosts(types, now),
    findTodayCrawl(now),
    listDrafts(6),
    listOpenNits(),
    countOpenNits(),
  ]);

  const cardPostIds = new Set([...todayPosts.values()].map((post) => post.id));
  const otherDrafts = drafts.filter((draft) => !cardPostIds.has(draft.id));

  return (
    <div className="flex min-h-full flex-col bg-paper">
      <AdminNav />

      <main className="mx-auto flex w-full max-w-[760px] flex-col gap-7 px-[5%] py-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-serif text-lg">{formatKstDay(now)}, 오늘의 기록</h1>
          <p className="font-typewriter text-[11px] text-faint">
            {/* QT는 크롤러가 채운다(06 §2). 일요일엔 크롤이 없으므로 배지도 없다 */}
            {isSunday(now) ? (
              "설교 · 찬양의 날"
            ) : crawl ? (
              <>
                크롤러 <b className="text-ink">{CRAWL_LABELS[crawl.status]}</b>
              </>
            ) : (
              "크롤러 대기 · 아직 오늘 수집 없음"
            )}
          </p>
        </div>

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
