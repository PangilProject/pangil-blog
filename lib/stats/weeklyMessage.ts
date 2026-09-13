import type { WeeklyStats } from "@/lib/db/weeklyDigest";
import { toKstDate } from "@/lib/record/kst";

/**
 * 주간 요약 Slack 문안 (06 §8 백로그 3·10).
 *
 * 판정과 서식을 화면·집계에서 떼어 여기서 테스트로 고정한다 — reminderMessage와 같은 자리다.
 *
 * **숫자만 적는다.** 백로그 3(주간 회고)에 "묵상 침범 위험" 경고가 달려 있다(06 §8). 잘했다·
 * 부진하다 같은 말을 붙이는 순간 이 알림은 기록을 평가하는 물건이 되고, 그건 이 블로그가
 * 하지 않기로 한 것이다. 전주 대비도 부호까지만 적고 해석하지 않는다.
 *
 * 한 줄에 다 밀어넣지 않고 줄을 나눈다. Slack은 긴 한 줄을 폭에 맞춰 접어버려서, 그러면
 * 무엇이 한 덩어리인지가 창 크기에 따라 달라진다.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** "9/7–9/13" — 요약이 덮는 7일. 끝은 어제다(오늘은 아직 안 끝났다) */
function period(now: Date): string {
  const last = new Date(now.getTime() - DAY_MS);
  const first = new Date(now.getTime() - 7 * DAY_MS);
  const short = (date: Date) => {
    const { month, day } = toKstDate(date);
    return `${month}/${day}`;
  };

  return `${short(first)}–${short(last)}`;
}

/**
 * "(전주 +19%)". 전주가 0이면 비율을 내지 않는다 — 0에서 늘어난 값은 언제나 무한대라
 * "+∞%"나 "+100%"나 둘 다 거짓말이다.
 */
function delta(current: number, previous: number): string {
  if (previous === 0) return current === 0 ? "" : " (첫 주)";

  const percent = Math.round(((current - previous) / previous) * 100);
  if (percent === 0) return " (전주와 같음)";

  return ` (전주 ${percent > 0 ? "+" : ""}${percent}%)`;
}

/** 긴 제목은 슬랙에서 줄을 먹는다. 자를 때 말줄임표를 붙여 잘렸다는 것을 보인다 */
function shorten(title: string | null, max = 24): string {
  const text = title?.trim() || "제목 없음";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function weeklyMessage(now: Date, stats: WeeklyStats): string {
  const lines = [
    `📊 주간 요약 · ${period(now)}`,
    `조회 ${stats.views}회${delta(stats.views, stats.prevViews)} · ` +
      `방문자 ${stats.visitors}명${delta(stats.visitors, stats.prevVisitors)}`,
  ];

  if (stats.topPosts.length > 0) {
    const posts = stats.topPosts.map((post) => `「${shorten(post.title)}」 ${post.views}`);
    lines.push(`많이 읽힌 글 · ${posts.join(" · ")}`);
  }

  if (stats.referrers.length > 0) {
    const from = stats.referrers.map((row) => `${row.host} ${row.views}`);
    lines.push(`유입 · ${from.join(" · ")}`);
  }

  // 크롤이 한 번도 없는 주에 "0/0 성공"은 실적이 아니라 고장으로 읽힌다. 그때는 적지 않는다 —
  // "아예 안 돎"은 watchdog가 그날그날 따로 알린다(06 §5)
  const crawl =
    stats.crawls.total > 0 ? ` · 크롤러 ${stats.crawls.success}/${stats.crawls.total}` : "";

  lines.push(`발행 ${stats.published}편${crawl}`);

  return lines.join("\n");
}
