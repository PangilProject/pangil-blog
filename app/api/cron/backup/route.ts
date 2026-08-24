import { authorizeBearer } from "@/lib/crawler/auth";
import { runBackup } from "@/lib/cron/tasks";

/**
 * `GET /api/cron/backup` — DB 논리 백업 (06 §8, MVP 편입).
 *
 * 크론은 아침 경로(`/api/cron/morning`)가 부른다. 이 경로는 손으로 한 장 받아둘 때 쓴다 —
 * 스키마를 건드리는 마이그레이션 직전 같은 때다.
 */
export async function GET(request: Request) {
  if (!authorizeBearer(request, process.env.CRON_SECRET)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await runBackup();

  return Response.json({ ok: result.ok, detail: result.detail }, { status: result.ok ? 200 : 500 });
}
