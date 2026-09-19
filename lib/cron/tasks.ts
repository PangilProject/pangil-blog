import "server-only";

import { watchdogVerdict } from "@/lib/crawler/watchdog";
import { dumpDatabase } from "@/lib/db/backup";
import { findCrawlRun } from "@/lib/db/crawlRuns";
import { findWeeklyStats } from "@/lib/db/weeklyDigest";
import { notifySlack } from "@/lib/notify/slack";
import { isSunday, kstDateKey } from "@/lib/record/kst";
import { weeklyMessage } from "@/lib/stats/weeklyMessage";
import { pruneBackups, uploadBackup } from "@/lib/storage/backups";

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

/**
 * 옛 백업 정리. **실패해도 백업은 성공이다.**
 *
 * 오늘 한 장은 이미 올라가 있고, 잃으면 안 되는 것은 그것이다 — 정리에 실패했다고 🔴을
 * 올리면 "백업이 실패했다"로 읽힌다. 대신 조용한 완료 줄에 한 마디를 붙여 둔다.
 */
async function sweepOldBackups(dateKey: string): Promise<string> {
  try {
    const { deleted } = await pruneBackups();
    return deleted.length > 0 ? ` · 옛것 ${deleted.length}장 정리` : "";
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    await notifySlack(`🟠 옛 백업 정리 실패 · ${dateKey} · ${detail}`);
    return " · 정리 실패";
  }
}

export async function runBackup(now = new Date()): Promise<TaskResult> {
  const dateKey = kstDateKey(now);

  try {
    const backup = await dumpDatabase(now);
    const uploaded = await uploadBackup(dateKey, JSON.stringify(backup));
    const size = `${Math.round(uploaded.bytes / 1024)}KB`;

    const swept = await sweepOldBackups(dateKey);

    await notifySlack(`🗄 백업 완료 · ${dateKey} · 글 ${backup.counts.posts}개 · ${size}${swept}`, {
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

/**
 * 주간 요약 (06 §8 백로그 3·10).
 *
 * **새 크론을 쓰지 않는다.** Hobby는 프로젝트당 크론 2개고 둘 다 찼다. 아침 경로가 매일
 * 부르되 일요일에만 보낸다 — 요일 판정 한 줄이 크론 자리 하나보다 싸다.
 *
 * 이 알림은 한 주에 한 번이라 `quiet`가 아니다. 매일 오는 숫자라면 읽히지 않겠지만
 * (lib/notify/slack.ts), 주 1회는 그 문턱을 넘지 않는다.
 */
export async function runWeeklyDigest(now = new Date()): Promise<TaskResult> {
  if (!isSunday(now)) return { ok: true, detail: "not-sunday" };

  const stats = await findWeeklyStats(now);
  await notifySlack(weeklyMessage(now, stats));

  return { ok: true, detail: "sent" };
}
