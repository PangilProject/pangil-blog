import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminNav } from "@/components/admin/AdminNav";
import { SimpleColumns } from "@/components/admin/SimpleColumns";
import { SITE_BAR, StatBar } from "@/components/admin/StatBars";
import { type LineMetric, StatLine } from "@/components/admin/StatLine";
import { EmptyState, formatSeconds, Panel, Tile, UnitTabs } from "@/components/admin/StatShell";
import { ADMIN_LOGIN_PATH } from "@/lib/auth/adminPaths";
import { getAdminUser } from "@/lib/auth/adminSession";
import {
  findDevices,
  findDwellTimes,
  findFirstEventAt,
  findHourly,
  findRecentEvents,
  findReferrers,
  findSeries,
  findTopPosts,
  findViewTotals,
  findVisitorTotals,
  findWeekdays,
  type SeriesPoint,
} from "@/lib/db/statSummary";
import { postHref } from "@/lib/site/publicUrl";
import { parseUnit, UNIT_WINDOW_DAYS, type Unit } from "@/lib/stats/range";
import { REFERRER_KIND_LABELS, referrerKind } from "@/lib/stats/referrer";
import { cn } from "@/lib/utils";

/**
 * A-09 통계 (05 §4 · Backlog 2순위 승격, 2026-08-25 사용자 결정).
 *
 * 문서는 이 화면을 "안 만든 것"으로 두고 있었다(00 §5.2 · 02 §2.6). 수집이 Day 1이고 그래프는
 * 나중이라는 판단이었는데, 수집이 돌기 시작하자 **볼 곳이 없다는 것이 곧 안 보는 것**이 되었다 —
 * 통계를 보려고 SQL 편집기를 여는 일은 일어나지 않는다.
 *
 * 범위는 좁게 둔다: 읽기 전용, **클라이언트 JS 0, 새 의존성 0**. 기간 토글도 링크다.
 *
 * **숫자에 거짓말을 시키지 않는다.** 순방문자를 여러 날에 걸쳐 세지 않고(해시가 날마다 바뀐다,
 * 05 §4.2), 체류 시간은 하한이라고 화면에 적는다(LEAVE 유실, 05 §4.4). 근거를 모르는 숫자는
 * 동기 시스템을 오히려 망친다(프리모템 #4).
 */

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;

/**
 * 이 지면은 `searchParams`를 읽는다 — 요청이 있어야 무엇을 그릴지 정해진다. 그래서 즉시
 * 전환용 껍데기를 미리 만들 수 없고, Next가 개발 중에 그 사실을 인사이트로 알린다.
 * 공개 목록도 같은 이유로 같은 선언을 갖고 있다(04 ADR-003).
 */
export const instant = false;

export default async function AdminStatsPage({ searchParams }: PageProps<"/admin/stats">) {
  const user = await getAdminUser();
  if (!user) redirect(ADMIN_LOGIN_PATH);

  const unit = parseUnit((await searchParams).unit);
  const days = UNIT_WINDOW_DAYS[unit];

  const [
    firstAt,
    visitors,
    views,
    series,
    topPosts,
    referrers,
    devices,
    dwell,
    hourly,
    weekdays,
    recent,
  ] = await Promise.all([
    findFirstEventAt(),
    findVisitorTotals(),
    findViewTotals(),
    findSeries(unit),
    findTopPosts(days, 10),
    findReferrers(days, 8),
    findDevices(days),
    findDwellTimes(days),
    findHourly(days),
    findWeekdays(days),
    findRecentEvents(20),
  ]);

  // "수집 N일째" — 경과일이다. 조회가 있던 날의 수가 아니다(빈 날도 수집은 돌고 있었다)
  const collectedDays = firstAt === null ? 0 : kstDaysBetween(firstAt, new Date()) + 1;

  const referrerMax = Math.max(...referrers.map((row) => row.views), 0);
  const postMax = Math.max(...topPosts.map((row) => row.views), 0);

  // 유입을 검색·사이트·직접으로 묶는다. 호스트 목록은 상한(8개)에 잘려 있으므로 그 합이 아니라
  // 각 호스트의 종류를 세는 것이 맞다 — 잘린 것을 빼면 비율이 틀린다
  const referrerTotal = referrers.reduce((sum, row) => sum + row.views, 0);
  const byKind = new Map<string, number>();
  for (const row of referrers) {
    const label = REFERRER_KIND_LABELS[referrerKind(row.host)];
    byKind.set(label, (byKind.get(label) ?? 0) + row.views);
  }
  const kinds = [...byKind]
    .map(([label, views]) => ({
      label,
      views,
      percent: referrerTotal > 0 ? Math.round((views / referrerTotal) * 100) : null,
    }))
    .sort((a, b) => b.views - a.views);
  const deviceTotal = devices.reduce((sum, row) => sum + row.views, 0);

  return (
    <div className="flex min-h-full flex-col bg-paper">
      <AdminNav />

      {/* 880px에서는 30칸 그래프의 날짜 라벨이 겹쳐 솎아내야 했다 — 한 화면에 더 담기게 넓힌다 */}
      <main className="mx-auto flex w-full max-w-[1040px] flex-col gap-8 px-[5%] py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-serif text-lg">통계</h1>
          {/* 화면의 유일한 조작 장치다(lib/stats/range 주석) */}
          <UnitTabs active={unit} basePath="/admin/stats" />
        </div>

        {firstAt === null ? (
          <EmptyState />
        ) : (
          <>
            {/*
              **무엇을 센 숫자인지 적는다.** 전에는 칸에 `오늘`이라고만 적혀 있어서, 공개
              지면 사이드바의 `오늘`(방문자)과 같은 값으로 읽혔다 — 둘 다 맞는 값인데
              이름이 없어서 어느 쪽이 틀렸다고 느껴졌다.

              주는 일요일에 시작한다 — 02 §3.1의 요일 카드와 같은 주여야 나란히 볼 수 있다.
              `최근 30일`과 지난주 증감선은 뺐다: 한 패널의 숫자를 줄이는 것이 이 개편의
              목적이고, 어제 칸이 옆에 있으면 증감은 눈으로 읽힌다.
            */}
            <Panel
              title="조회"
              note="큰 숫자는 공개 지면에 적히는 값이에요. 아래 줄은 내 방문을 뺀 값이에요"
            >
              {/*
                **한 기간 = 한 칸.** 전에는 본인 제외 4칸 아래에 "공개 지면 표시" 3개와
                "그중 내 방문" 3개를 줄로 더 깔았다 — 한 패널에 숫자가 열 개였고, 무엇과
                무엇을 비교해야 하는지가 보이지 않았다.
                기간마다 두 값을 한 칸에 짝지으면 비교가 칸 안에서 끝난다.
              */}
              <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Tile
                  label="오늘"
                  value={views.all.today}
                  sub={excludingMine(views.others.today)}
                />
                <Tile
                  label="어제"
                  value={views.all.yesterday}
                  sub={excludingMine(views.others.yesterday)}
                />
                <Tile
                  label="이번 주"
                  value={views.all.thisWeek}
                  sub={excludingMine(views.others.thisWeek)}
                />
                <Tile
                  label="통산"
                  value={views.all.total}
                  sub={excludingMine(views.others.total)}
                />
              </section>
            </Panel>

            {/*
              사이드바에 적히는 그 숫자다. 여기 나란히 두어야 "둘이 다르다"가 "둘은 다른
              것을 센다"로 읽힌다. 주·월 방문자는 없다 — 날마다 세는 값이라 여러 날에 걸쳐
              같은 사람을 이을 수 없다(05 §4.2).
            */}
            <Panel
              title="방문자"
              note="몇 사람이 왔는지예요(내 방문 제외). 날마다 세어 더하므로 같은 사람이 사흘 오면 3이에요"
            >
              <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Tile
                  label="오늘"
                  value={visitors.today}
                  previous={visitors.yesterday}
                  previousLabel="어제"
                />
                <Tile label="통산" value={visitors.total} sub={`수집 ${collectedDays}일째`} />
              </section>
            </Panel>

            <Panel
              title="추이"
              note={
                unit === "day"
                  ? `최근 ${days}일 · 점에 올리면 그날의 수치가 나와요`
                  : unit === "week"
                    ? "최근 12주"
                    : "최근 12개월"
              }
            >
              {/*
                **조회와 방문자를 나란히 둔다.** 한 선만 보면 "많이 읽혔다"와 "많이들 왔다"가
                구별되지 않는다 — 한 사람이 열 편을 본 날과 열 사람이 한 편씩 본 날은 완전히
                다른 신호인데 조회 선에서는 같은 높이다.

                방문자 선은 **일별에만** 있다. 주·월은 여러 날에 걸쳐 같은 사람을 이을 수
                없으므로(05 §4.2) 그 선을 그리면 없는 값을 그린 것이 된다.
              */}
              <div className="flex flex-col gap-6">
                <Series label="일간 조회" points={series} unit={unit} />

                {unit === "day" && (
                  <Series label="일간 방문자" points={series} unit={unit} metric="visitors" />
                )}
              </div>
            </Panel>

            {topPosts.length > 0 && (
              <Panel title="많이 읽힌 글" note="제목을 누르면 그 글의 추이가 열려요">
                <ol className="flex flex-col gap-2">
                  {topPosts.map((row, rank) => (
                    <li key={row.id} className="flex items-center gap-3">
                      {/* 순위가 이 목록의 요점이다 — 흐린 10.5px로는 몇 번째인지 눈에 안 든다.
                          위 세 칸만 액센트를 준다: 그 아래는 순서보다 "이만큼 읽혔다"가 중요하다 */}
                      <span
                        className={cn(
                          "w-[18px] flex-none text-right font-typewriter text-[12px] tabular-nums",
                          rank < 3 ? "font-bold text-(--accent)" : "text-faint",
                        )}
                      >
                        {rank + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px]">
                        {/* 지워진 글의 조회도 남는다 — postId는 FK가 아니다(05 §1.4) */}
                        {row.title ? (
                          <Link
                            href={`/admin/stats/${row.id}`}
                            className="hover:text-(--accent)"
                            title={row.title}
                          >
                            {row.title}
                          </Link>
                        ) : (
                          <em className="text-faint not-italic">지워진 글</em>
                        )}
                      </span>
                      <span className="relative h-[14px] w-[34%] flex-none bg-surface-tab">
                        <span
                          className={
                            row.type === "TECH"
                              ? `absolute inset-y-0 left-0 ${SITE_BAR.dev}`
                              : `absolute inset-y-0 left-0 ${SITE_BAR.faith}`
                          }
                          style={{ width: postMax > 0 ? `${(row.views / postMax) * 100}%` : "0%" }}
                        />
                      </span>
                      <span className="w-[44px] flex-none text-right font-typewriter text-[11px]">
                        {row.views}
                      </span>
                    </li>
                  ))}
                </ol>
              </Panel>
            )}

            <div className="grid gap-8 sm:grid-cols-2">
              <Panel
                title="유입 경로"
                note="검색이 늘면 그 주제를 더 쓸 신호예요. 사이트는 어디서 링크됐는지 볼 일이고요"
              >
                {/* 티스토리 통계처럼 검색·사이트·직접을 먼저 갈라 보여준다 */}
                <div className="mb-1 flex flex-wrap gap-x-4 gap-y-1 border-edge border-b pb-2 font-typewriter text-[10.5px]">
                  {kinds.map((kind) => (
                    <span key={kind.label} className="text-faint">
                      {kind.label} <b className="text-ink">{kind.views.toLocaleString("ko-KR")}</b>
                      {kind.percent !== null && (
                        <em className="ml-1 text-[10px] not-italic">{kind.percent}%</em>
                      )}
                    </span>
                  ))}
                </div>

                {referrers.map((row) => (
                  <StatBar
                    key={row.host}
                    label={row.host}
                    max={referrerMax}
                    segments={[{ label: row.host, value: row.views, className: SITE_BAR.plain }]}
                  />
                ))}
              </Panel>

              <Panel title="기기" note="모바일이 많으면 조판을 모바일 기준으로 봐요">
                {devices.map((row) => (
                  <StatBar
                    key={row.device}
                    label={row.device === "MOBILE" ? "모바일" : "데스크탑"}
                    max={deviceTotal}
                    note={
                      deviceTotal > 0
                        ? `${Math.round((row.views / deviceTotal) * 100)}%`
                        : undefined
                    }
                    segments={[{ label: row.device, value: row.views, className: SITE_BAR.plain }]}
                  />
                ))}
              </Panel>
            </div>

            <div className="grid gap-8 sm:grid-cols-2">
              <Panel title="시간대 (KST)" note="발행·공유 시각을 정할 때 봐요">
                <SimpleColumns
                  labelEvery={3}
                  points={hourly.map((row) => ({
                    key: String(row.hour),
                    label: String(row.hour).padStart(2, "0"),
                    value: row.views,
                    tooltip: `${String(row.hour).padStart(2, "0")}시 · 조회 ${row.views}`,
                  }))}
                />
              </Panel>

              <Panel title="요일" note="한 주는 설교를 쓰는 일요일에 시작해요">
                <SimpleColumns
                  points={weekdays.map((row) => ({
                    key: String(row.weekday),
                    label: WEEKDAY_LABELS[row.weekday],
                    value: row.views,
                    tooltip: `${WEEKDAY_LABELS[row.weekday]}요일 · 조회 ${row.views}`,
                  }))}
                />
              </Panel>
            </div>

            {dwell.length > 0 && (
              <Panel title="체류 시간" note="창을 닫으면 기록이 빠져서 실제보다 짧게 나와요">
                <ul className="flex flex-col gap-2">
                  {dwell.map((row) => (
                    <li key={row.id} className="flex items-baseline gap-3">
                      <span className="min-w-0 flex-1 truncate text-[13px]">
                        {row.title || <em className="text-faint not-italic">지워진 글</em>}
                      </span>
                      <span className="font-typewriter text-[11px] text-ink">
                        {formatSeconds(row.seconds)}
                      </span>
                      <span className="w-[52px] flex-none text-right font-typewriter text-[10px] text-faint">
                        {row.samples}번
                      </span>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}

            <Panel title="최근 흔적" note="방금 일어난 조회를 순서대로">
              <ul className="flex flex-col gap-1.5 font-typewriter text-[11px]">
                {recent.map((event) => (
                  <li key={event.id} className="flex items-baseline gap-2.5">
                    <span className="w-[42px] flex-none text-faint">
                      {new Intl.DateTimeFormat("ko-KR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                        timeZone: "Asia/Seoul",
                      }).format(event.occurredAt)}
                    </span>
                    <span
                      className={
                        event.eventType === "PAGEVIEW"
                          ? "w-[26px] flex-none text-(--accent)"
                          : "w-[26px] flex-none text-faint"
                      }
                    >
                      {event.eventType === "PAGEVIEW" ? "조회" : "떠남"}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {event.title ? (
                        event.type && event.slug ? (
                          <Link
                            href={postHref(event.type, event.slug)}
                            className="hover:text-(--accent)"
                          >
                            {event.title}
                          </Link>
                        ) : (
                          event.title
                        )
                      ) : (
                        <span className="text-faint">{event.path}</span>
                      )}
                    </span>
                    <span className="flex-none text-[10px] text-faint">
                      {event.device === "MOBILE" ? "모바일" : "데스크탑"}
                      {event.durationMs !== null && ` · ${formatSeconds(event.durationMs / 1000)}`}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          </>
        )}
      </main>
    </div>
  );
}

/**
 * 선 하나 + 그 위 작은 이름.
 *
 * 두 선을 같은 패널에 두므로 어느 선이 무엇인지 각자 말해야 한다 — 패널 제목 하나로는
 * 둘을 가리킬 수 없다.
 */
function Series({
  label,
  points,
  unit,
  metric,
}: {
  label: string;
  points: SeriesPoint[];
  unit: Unit;
  metric?: LineMetric;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-typewriter text-[10px] tracking-[0.14em] text-faint">{label}</p>
      <StatLine points={points} unit={unit} metric={metric} />
    </div>
  );
}

/** KST 날짜 기준 경과일. 자정 경계를 넘긴 횟수를 세므로 시:분에 흔들리지 않는다 */
/**
 * 칸 아래 작은 줄.
 *
 * `밖에서 39`라고 적었다가 고쳤다 — 한국어로 읽히지 않았다. 티스토리에 **"내 방문 수 제외"**
 * 라는 설정이 있어서 그 말이 익숙하고, 무엇을 뺐는지도 그대로 말한다(03 §7.2).
 */
function excludingMine(value: number): string {
  return `내 방문 제외 ${value.toLocaleString("ko-KR")}`;
}

function kstDaysBetween(from: Date, to: Date): number {
  const KST = 9 * 60 * 60 * 1000;
  const day = 24 * 60 * 60 * 1000;
  const startOf = (date: Date) => Math.floor((date.getTime() + KST) / day);
  return startOf(to) - startOf(from);
}
