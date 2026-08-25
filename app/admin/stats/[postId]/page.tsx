import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AdminNav } from "@/components/admin/AdminNav";
import { SITE_BAR, StatBar } from "@/components/admin/StatBars";
import { formatSeconds, Panel, TextTile, Tile } from "@/components/admin/StatShell";
import { ADMIN_LOGIN_PATH } from "@/lib/auth/adminPaths";
import { getAdminUser } from "@/lib/auth/adminSession";
import { findEditablePost } from "@/lib/db/posts";
import {
  findPostDaily,
  findPostDevices,
  findPostReferrers,
  findPostStatSummary,
} from "@/lib/db/statSummary";
import { publicPostPath } from "@/lib/record/paths";
import { editorPath } from "@/lib/record/todayCard";

/**
 * A-09 글 하나의 추이.
 *
 * **왜 이 화면이 있나.** 총합만으로는 "오래된 글이 계속 읽힌다"와 "발행 직후에만 읽혔다"를
 * 구별할 수 없다. 그 둘은 완전히 다른 신호다 — 앞은 그 주제를 더 쓰라는 뜻이고, 뒤는
 * 그 글이 한 번 소비되고 끝났다는 뜻이다. 00 §6.3이 "SEO 투자를 기술 글에 집중"이라고 한
 * 판단을 실제로 하려면 이 구별이 필요하다.
 *
 * 마지막 조회 시점을 크게 적는다. 그게 "지금도 읽히는 글인가"의 답이다.
 */
export default async function AdminPostStatsPage({ params }: PageProps<"/admin/stats/[postId]">) {
  const user = await getAdminUser();
  if (!user) redirect(ADMIN_LOGIN_PATH);

  const { postId } = await params;

  /**
   * 이 화면은 창을 고르게 하지 않는다. 답해야 하는 질문이 하나뿐이기 때문이다 —
   * **"이 글은 지금도 읽히나, 발행 직후만 읽혔나."** 90일 한 장이면 그 모양이 보이고,
   * 토글을 두면 그때부터 "어느 창에서 봤는지"를 기억해야 한다.
   */
  const days = 90;

  const [post, summary, daily, referrers, devices] = await Promise.all([
    findEditablePost(postId),
    findPostStatSummary(postId),
    findPostDaily(postId, days),
    findPostReferrers(postId),
    findPostDevices(postId),
  ]);

  // 글이 지워졌어도 통계는 남는다(05 §1.4). 하지만 통계도 없으면 그건 없는 주소다
  if (!post && summary.views === 0) notFound();

  const dailyMax = Math.max(...daily.map((row) => row.views), 0);
  const referrerMax = Math.max(...referrers.map((row) => row.views), 0);
  const deviceTotal = devices.reduce((sum, row) => sum + row.views, 0);
  const barClass = post?.type === "TECH" ? SITE_BAR.dev : SITE_BAR.faith;

  return (
    <div className="flex min-h-full flex-col bg-paper">
      <AdminNav />

      <main className="mx-auto flex w-full max-w-[760px] flex-col gap-8 px-[5%] py-8">
        <div className="flex flex-col gap-3">
          <Link
            href="/admin/stats"
            className="font-typewriter text-[10.5px] text-faint hover:text-ink"
          >
            ← 통계
          </Link>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="min-w-0 font-serif text-lg">
              {post?.title || <em className="text-faint not-italic">지워진 글</em>}
            </h1>
          </div>

          {post && (
            <nav className="flex gap-3 font-typewriter text-[10.5px] text-faint">
              {post.slug && (
                <Link href={publicPostPath(post.type, post.slug)} className="hover:text-ink">
                  공개 지면 보기
                </Link>
              )}
              <Link href={editorPath(post.type, post.id)} className="hover:text-ink">
                고치기
              </Link>
            </nav>
          )}
        </div>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="통산 조회" value={summary.views} />
          <TextTile
            label="평균 체류"
            // 초만 적으면 200초가 긴지 짧은지 감이 안 온다
            value={summary.avgSeconds === null ? "—" : formatSeconds(summary.avgSeconds)}
            sub={summary.dwellSamples > 0 ? `표본 ${summary.dwellSamples}건` : "표본 없음"}
          />
          <TextTile
            label="마지막 조회"
            value={
              summary.lastSeen
                ? new Intl.DateTimeFormat("ko-KR", {
                    dateStyle: "medium",
                    timeZone: "Asia/Seoul",
                  }).format(summary.lastSeen)
                : "—"
            }
            // 이 둘이 멀면 "지금도 읽히는 글"이고, 붙어 있으면 발행 직후만 읽힌 글이다
            sub={
              summary.firstSeen
                ? `첫 조회 ${new Intl.DateTimeFormat("ko-KR", {
                    dateStyle: "medium",
                    timeZone: "Asia/Seoul",
                  }).format(summary.firstSeen)}`
                : undefined
            }
          />
          <TextTile
            label="지면"
            value={post ? (post.type === "TECH" ? "기술" : "묵상") : "—"}
            sub={post?.callNumber ? `청구기호 ${post.callNumber}` : undefined}
          />
        </section>

        {daily.length === 0 ? (
          <div className="border border-edge border-dashed bg-card px-5 py-8 text-center text-[13px] text-faint">
            최근 {days}일 동안 조회가 없습니다.
            {summary.firstSeen && " 그 전에는 읽혔습니다 — 기간을 늘려 보세요."}
          </div>
        ) : (
          <Panel title={`일별 조회 · 최근 ${days}일`}>
            {daily.map((row) => (
              <StatBar
                key={row.day}
                label={row.day.slice(5)}
                max={dailyMax}
                segments={[{ label: row.day, value: row.views, className: barClass }]}
              />
            ))}
          </Panel>
        )}

        <div className="grid gap-8 sm:grid-cols-2">
          {referrers.length > 0 && (
            <Panel title="유입 경로" note="이 글의 통산 기준">
              {referrers.map((row) => (
                <StatBar
                  key={row.host}
                  label={row.host}
                  max={referrerMax}
                  segments={[{ label: row.host, value: row.views, className: SITE_BAR.plain }]}
                />
              ))}
            </Panel>
          )}

          {devices.length > 0 && (
            <Panel title="기기">
              {devices.map((row) => (
                <StatBar
                  key={row.device}
                  label={row.device === "MOBILE" ? "모바일" : "데스크탑"}
                  max={deviceTotal}
                  note={
                    deviceTotal > 0 ? `${Math.round((row.views / deviceTotal) * 100)}%` : undefined
                  }
                  segments={[{ label: row.device, value: row.views, className: SITE_BAR.plain }]}
                />
              ))}
            </Panel>
          )}
        </div>
      </main>
    </div>
  );
}
