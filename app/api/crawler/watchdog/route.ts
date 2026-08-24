import { authorizeBearer } from "@/lib/crawler/auth";
import { watchdogVerdict } from "@/lib/crawler/watchdog";
import { findCrawlRun } from "@/lib/db/crawlRuns";
import { notifySlack } from "@/lib/notify/slack";
import { kstDateKey } from "@/lib/record/kst";

/**
 * `GET /api/crawler/watchdog` — 데드맨 스위치 (06 §5).
 *
 * Vercel 크론이 하루 한 번(UTC 02:00 = KST 11:00) 부른다. 크롤 창(KST 06:00)에서 충분히
 * 지난 시각이라, 이때까지 흔적이 없으면 오늘은 수동으로 써야 한다는 뜻이다.
 *
 * Hobby 크론은 "하루 1회 · 시간 단위 근사 실행"이 한계인데 이 용도에는 정확히 맞는다.
 * 외부 감시 서비스를 붙이지 않는 이유이기도 하다(프리모템 #6 — 의존성 최소화).
 */
export async function GET(request: Request) {
  if (!authorizeBearer(request, process.env.CRON_SECRET)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const run = await findCrawlRun(kstDateKey(now));
  const verdict = watchdogVerdict({ now, run });

  if (verdict.alert) {
    await notifySlack(verdict.message);
    return Response.json({ ok: true, alerted: true });
  }

  return Response.json({ ok: true, alerted: false, reason: verdict.reason });
}
