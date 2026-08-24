import { authorizeBearer } from "@/lib/crawler/auth";
import { runWatchdog } from "@/lib/cron/tasks";

/**
 * `GET /api/crawler/watchdog` — 데드맨 스위치 (06 §5).
 *
 * 3층 방어 중 ②다. ①(Actions가 실패를 보고)은 **Actions가 돌기라도 했을 때만** 발화한다.
 * 정작 프리모템 #1의 최악은 "아예 안 돎"이다 — Actions 스케줄은 레포가 60일 조용하면
 * 자동으로 꺼진다. 그래서 앱 쪽에서 "오늘 흔적이 있는가"를 따로 본다.
 *
 * 크론은 아침 경로(`/api/cron/morning`)가 부른다 — Hobby 크론이 2개뿐이라 백업과 묶었다.
 * 이 경로는 손으로 확인할 때 쓴다.
 */
export async function GET(request: Request) {
  if (!authorizeBearer(request, process.env.CRON_SECRET)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await runWatchdog();

  return Response.json(result);
}
