import Link from "next/link";
import { notFound } from "next/navigation";

import { SITE_BAR, StatBar } from "@/components/admin/StatBars";
import { StatLine } from "@/components/admin/StatLine";
import { formatSeconds, Panel, TextTile, Tile } from "@/components/admin/StatShell";
import { findEditablePost } from "@/lib/db/posts";
import {
  findPostDevices,
  findPostReferrers,
  findPostSeries,
  findPostStatSummary,
} from "@/lib/db/statSummary";
import { editorPath } from "@/lib/record/todayCard";
import { postHref } from "@/lib/site/publicUrl";

/**
 * 이 화면은 창을 고르게 하지 않는다. 답해야 하는 질문이 하나뿐이기 때문이다 —
 * **"이 글은 지금도 읽히나, 발행 직후만 읽혔나."** 90일 한 장이면 그 모양이 보이고,
 * 토글을 두면 그때부터 "어느 창에서 봤는지"를 기억해야 한다.
 */
const DAYS = 90;

/**
 * 그래프를 첫 조회 날부터 그린다. 발행 전의 0을 90일 내내 깔면 그래프의 대부분이 바닥이 되고
 * 읽힌 날이 오른쪽 끝에 몰린다. 다만 너무 짧으면 선이 아니라 점 몇 개라 2주는 남긴다.
 */
const MIN_DAYS = 14;

/** 한 달 안쪽은 날짜를 다 적는다(StatLine 원칙). 넘으면 겹치므로 한 주에 한 번 — 요일이 고정되어 눈금처럼 읽힌다 */
function labelEveryOf(length: number): number {
  return length <= 31 ? 1 : 7;
}

/** 앞쪽의 조회 0인 날을 걷어낸다. 남는 칸은 MIN_DAYS 이상이다 */
function fromFirstView<T extends { views: number }>(points: T[]): T[] {
  const first = points.findIndex((point) => point.views > 0);
  if (first === -1) return points;
  return points.slice(Math.min(first, Math.max(points.length - MIN_DAYS, 0)));
}

const ACTION =
  "border border-edge bg-card px-2.5 py-1 font-typewriter text-[11px] text-ink-soft transition-colors duration-150 hover:border-ink-soft hover:text-ink";

const DATE_FORMAT = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeZone: "Asia/Seoul",
});

/**
 * A-09 글 하나의 추이 — 본문.
 *
 * **왜 이 화면이 있나.** 총합만으로는 "오래된 글이 계속 읽힌다"와 "발행 직후에만 읽혔다"를
 * 구별할 수 없다. 그 둘은 완전히 다른 신호다 — 앞은 그 주제를 더 쓰라는 뜻이고, 뒤는
 * 그 글이 한 번 소비되고 끝났다는 뜻이다. 00 §6.3이 "SEO 투자를 기술 글에 집중"이라고 한
 * 판단을 실제로 하려면 이 구별이 필요하다.
 *
 * **페이지와 모달이 같은 본문을 쓴다.** 목록에서 누르면 모달(`@modal/(..)stats/[postId]`)로,
 * 새로고침·직접 접속이면 페이지(`[postId]`)로 열린다. 둘이 따로 그리면 한쪽만 고쳐진다.
 * 모달은 질문에 답하는 것 — 타일과 추이 — 만 담고, 유입·기기는 페이지에만 둔다.
 */
export async function PostStats({
  postId,
  inModal = false,
}: {
  postId: string;
  inModal?: boolean;
}) {
  const [post, summary, series, referrers, devices] = await Promise.all([
    findEditablePost(postId),
    findPostStatSummary(postId),
    findPostSeries(postId, DAYS),
    inModal ? [] : findPostReferrers(postId),
    inModal ? [] : findPostDevices(postId),
  ]);

  // 글이 지워졌어도 통계는 남는다(05 §1.4). 하지만 통계도 없으면 그건 없는 주소다
  if (!post && summary.views === 0) notFound();

  const hasRecent = series.some((point) => point.views > 0);
  const points = fromFirstView(series);
  const referrerMax = Math.max(...referrers.map((row) => row.views), 0);
  const deviceTotal = devices.reduce((sum, row) => sum + row.views, 0);

  return (
    <>
      <div className="flex flex-col gap-3">
        {/* 모달에서는 제목이 대화상자의 이름이다(StatModal의 aria-labelledby) */}
        <h1 id={inModal ? "post-stats-title" : undefined} className="min-w-0 font-serif text-lg">
          {post?.title || <em className="text-faint not-italic">지워진 글</em>}
        </h1>

        {/*
          흐린 글자만으로는 누를 수 있는 것인지 안 보였다 — 테두리를 둘러 버튼으로 읽히게 한다.
          이름은 "글 ○○ / 통계 ○○"로 맞추고 화살표는 달지 않는다: 셋 다 이 자리를 떠나는
          이동이라, 하나에만 붙이면 나머지가 다른 종류의 버튼처럼 보인다
        */}
        <nav className="flex flex-wrap gap-2">
          {post?.slug && (
            <Link href={postHref(post.type, post.slug)} className={ACTION}>
              글 보기
            </Link>
          )}
          {post && (
            <Link href={editorPath(post.type, post.id)} className={ACTION}>
              글 수정
            </Link>
          )}
          {/*
            `<a>`다. `Link`로 같은 주소에 가면 다시 가로채여 모달이 그대로 남는다 —
            문서 이동이어야 페이지가 그려진다
          */}
          {inModal && (
            <a href={`/admin/stats/${postId}`} className={ACTION}>
              통계 상세
            </a>
          )}
        </nav>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="통산 조회" value={summary.views} />
        <TextTile
          label="평균 체류"
          // 초만 적으면 200초가 긴지 짧은지 감이 안 온다
          value={summary.avgSeconds === null ? "—" : formatSeconds(summary.avgSeconds)}
          sub={summary.dwellSamples > 0 ? `${summary.dwellSamples}번 기준` : "아직 기록이 없어요"}
        />
        <TextTile
          label="마지막 조회"
          value={summary.lastSeen ? DATE_FORMAT.format(summary.lastSeen) : "—"}
          // 이 둘이 멀면 "지금도 읽히는 글"이고, 붙어 있으면 발행 직후만 읽힌 글이다
          sub={summary.firstSeen ? `첫 조회 ${DATE_FORMAT.format(summary.firstSeen)}` : undefined}
        />
        <TextTile
          label="지면"
          value={post ? (post.type === "TECH" ? "기술" : "묵상") : "—"}
          sub={post?.callNumber ? `청구기호 ${post.callNumber}` : undefined}
        />
      </section>

      {hasRecent ? (
        <Panel
          title={`일별 조회 · 최근 ${points.length}일`}
          note={
            points.length < series.length
              ? `첫 조회부터 그렸어요(최대 ${DAYS}일) · 칸에 올리면 그날의 수치가 나와요`
              : "칸에 올리면 그날의 수치가 나와요"
          }
        >
          <StatLine points={points} unit="day" labelEvery={labelEveryOf(points.length)} sparse />
        </Panel>
      ) : (
        <div className="border border-edge border-dashed bg-card px-5 py-8 text-center text-[13px] text-faint">
          최근 {DAYS}일 동안 조회가 없어요.
          {summary.firstSeen && " 그 전에는 읽혔어요."}
        </div>
      )}

      {!inModal && (
        <div className="grid gap-8 sm:grid-cols-2">
          {referrers.length > 0 && (
            <Panel title="유입 경로" note="이 글이 쌓아온 전체 기준">
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
      )}
    </>
  );
}
