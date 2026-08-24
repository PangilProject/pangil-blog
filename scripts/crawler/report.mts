import type { CrawlIngestBody } from "@/lib/crawler/ingestSchema";

/**
 * ingest 보고 (06 §2 report · §4).
 *
 * Actions는 crawl_runs에 직접 쓰지 않는다 — DB 자격증명을 러너에 두지 않기 위해서다.
 * 여기서 하는 일은 결과를 한 번 POST하는 것뿐이고, 기록·알림은 서버가 한다.
 *
 * 이 POST가 끝까지 실패하면 그날은 **어떤 흔적도 남지 않는다.** 그 구멍은 watchdog가
 * 덮는다(06 §5) — 그래서 여기서 조용히 성공한 척하지 않고 그냥 던진다.
 */

export class IngestError extends Error {
  readonly name = "IngestError";
}

const TIMEOUT_MS = 15_000;

/** 2s → 5s → 10s (06 §4). 마지막 실패는 호출자가 exit 1로 끝낸다 */
export const RETRY_DELAYS_MS = [2000, 5000, 10_000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type Retryable<T> = () => Promise<T>;

export async function withRetry<T>(
  task: Retryable<T>,
  {
    label,
    delays = RETRY_DELAYS_MS,
    retryIf = () => true,
  }: { label: string; delays?: number[]; retryIf?: (error: unknown) => boolean },
): Promise<T> {
  let last: unknown;

  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      last = error;
      // 재시도해도 결과가 같은 실패(4xx·자격증명)는 여기서 끝낸다 — 30초를 버리고
      // 같은 실패를 다시 보는 대신, 알림이 30초 먼저 간다
      if (!retryIf(error)) break;
      const delay = delays[attempt];
      if (delay === undefined) break;
      console.warn(`[crawl] ${label} 실패, ${delay}ms 후 재시도 (${attempt + 1}/${delays.length})`);
      await sleep(delay);
    }
  }

  throw last;
}

/** 5xx·타임아웃처럼 다시 시도해볼 만한 실패 */
class TransientError extends Error {
  readonly name = "TransientError";
}

export type ReportTarget = {
  /** 예: https://pangil.me — 경로는 여기서 붙인다 */
  baseUrl: string;
  token: string;
};

export async function report(body: CrawlIngestBody, target: ReportTarget): Promise<unknown> {
  const url = `${target.baseUrl.replace(/\/$/, "")}/api/crawler/ingest`;

  return withRetry(
    async () => {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${target.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      const text = await response.text();

      // 4xx는 우리 쪽 요청이 틀린 것이다 — 재시도해도 같으므로 바로 끝낸다
      if (response.status >= 400 && response.status < 500) {
        throw new IngestError(`ingest ${response.status}: ${text.slice(0, 300)}`);
      }

      if (!response.ok) {
        throw new TransientError(`ingest ${response.status}: ${text.slice(0, 300)}`);
      }

      return text ? JSON.parse(text) : null;
    },
    // 4xx는 우리 요청이 틀린 것이므로 재시도하지 않는다
    { label: "ingest 보고", retryIf: (error) => !(error instanceof IngestError) },
  );
}
