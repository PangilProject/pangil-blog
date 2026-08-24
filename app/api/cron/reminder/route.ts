import { authorizeBearer } from "@/lib/crawler/auth";
import { findTodayPosts } from "@/lib/db/today";
import { notifySlack } from "@/lib/notify/slack";
import { reminderMessage } from "@/lib/record/reminder";
import { todayCardTypes } from "@/lib/record/todayCard";

/**
 * `GET /api/cron/reminder` — 미작성일 리마인드 (06 §8, MVP 편입).
 *
 * 저녁(KST 21:00)에 오늘 몫이 발행되지 않았으면 알린다. 크롤러가 초안을 만들어둔 것과
 * 하루를 마친 것은 다르다 — 판정은 lib/record/reminder에 있고 테스트로 고정되어 있다.
 */
export async function GET(request: Request) {
  if (!authorizeBearer(request, process.env.CRON_SECRET)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const types = todayCardTypes(now);
  const posts = await findTodayPosts(types, now);
  const message = reminderMessage({ now, types, posts });

  if (!message) return Response.json({ ok: true, notified: false });

  await notifySlack(message);
  return Response.json({ ok: true, notified: true });
}
