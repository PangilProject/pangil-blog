import "server-only";

import { watchdogVerdict } from "@/lib/crawler/watchdog";
import { dumpDatabase } from "@/lib/db/backup";
import { findCrawlRun } from "@/lib/db/crawlRuns";
import { notifySlack } from "@/lib/notify/slack";
import { kstDateKey } from "@/lib/record/kst";
import { uploadBackup } from "@/lib/storage/backups";

/**
 * 크론 작업 본체 (06 §5 · §8).
 *
 * 경로에서 떼어낸 이유는 **Vercel Hobby가 프로젝트당 크론 2개**이기 때문이다. 06 §5는
 * 크론 개수가 넉넉하다고 적었지만 그건 Pro 기준이다. 그래서 아침 경로 하나가 watchdog와
 * 백업을 이어서 돌리고, 각 작업은 손으로도 부를 수 있게 개별 경로로 남겨둔다.
 *
 * 두 작업은 **서로를 막지 않는다.** 백업이 실패해도 watchdog 알림은 이미 나갔고,
 * watchdog가 실패해도 백업은 돈다 — 하나의 사고가 둘을 함께 잃게 하지 않는다.
 */

export type TaskResult = { ok: boolean; detail: string };

export async function runWatchdog(now = new Date()): Promise<TaskResult> {
  const run = await findCrawlRun(kstDateKey(now));
  const verdict = watchdogVerdict({ now, run });

  if (!verdict.alert) return { ok: true, detail: verdict.reason };

  await notifySlack(verdict.message);
  return { ok: true, detail: "alerted" };
}

export async function runBackup(now = new Date()): Promise<TaskResult> {
  const dateKey = kstDateKey(now);

  try {
    const backup = await dumpDatabase(now);
    const uploaded = await uploadBackup(dateKey, JSON.stringify(backup));
    const size = `${Math.round(uploaded.bytes / 1024)}KB`;

    await notifySlack(`🗄 백업 완료 · ${dateKey} · 글 ${backup.counts.posts}개 · ${size}`, {
      quiet: true,
    });

    return { ok: true, detail: uploaded.path };
  } catch (error) {
    // 백업이 조용히 실패하면 필요한 날 없다는 것을 알게 된다
    const detail = error instanceof Error ? error.message : String(error);
    await notifySlack(`🔴 백업 실패 · ${dateKey} · ${detail}`);
    return { ok: false, detail };
  }
}
