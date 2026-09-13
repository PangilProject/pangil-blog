import { authorizeBearer } from "@/lib/crawler/auth";
import { findWeeklyStats } from "@/lib/db/weeklyDigest";
import { notifySlack } from "@/lib/notify/slack";
import { weeklyMessage } from "@/lib/stats/weeklyMessage";

/**
 * `GET /api/cron/weekly` — 주간 요약을 손으로 보낸다 (06 §8).
 *
 * 크론은 아침 경로(`/api/cron/morning`)가 일요일에만 부른다. 이 경로는 **요일을 보지 않는다**
 * — 문안을 고치고 실물을 한 번 보고 싶을 때 일요일까지 기다릴 이유가 없다.
 *
 * `?dry=1`이면 Slack으로 보내지 않고 문안만 돌려준다. 채널을 더럽히지 않고 확인하는 길이다.
 */
export async function GET(request: Request) {
  if (!authorizeBearer(request, process.env.CRON_SECRET)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const message = weeklyMessage(now, await findWeeklyStats(now));

  if (new URL(request.url).searchParams.get("dry") === "1") {
    return Response.json({ ok: true, sent: false, message });
  }

  await notifySlack(message);
  return Response.json({ ok: true, sent: true, message });
}
