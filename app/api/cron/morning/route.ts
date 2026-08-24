import { authorizeBearer } from "@/lib/crawler/auth";
import { runBackup, runWatchdog } from "@/lib/cron/tasks";

/**
 * `GET /api/cron/morning` — 아침 점검 (06 §5 watchdog + §8 백업).
 *
 * Vercel Hobby는 프로젝트당 크론 2개다. 그래서 하루 두 번의 자리를 이렇게 쓴다:
 * 아침(KST 11:00)에는 "어제·오늘 크롤이 돌았는가"와 백업, 저녁에는 리마인드.
 *
 * 크롤 창(KST 06:00)에서 다섯 시간 지난 시각이라, 이때 흔적이 없으면 오늘은 손으로 쓴다.
 */
export async function GET(request: Request) {
  if (!authorizeBearer(request, process.env.CRON_SECRET)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // 백업이 실패해도 watchdog 알림은 나가야 한다 — 순서대로, 서로 막지 않게
  const watchdog = await runWatchdog(now);
  const backup = await runBackup(now);

  return Response.json({ ok: watchdog.ok && backup.ok, watchdog, backup });
}
