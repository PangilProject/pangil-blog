"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { requestQtCrawl } from "@/lib/actions/crawl";
import { type CrawlTriggerState, crawlTriggerLabel } from "@/lib/record/crawlTrigger";

/**
 * 손으로 QT 크롤 부르기 (A-01).
 *
 * 크롤 상태 문구 옆에 선다. "아직 오늘 큐티를 못 가져왔어요" 다음에 할 수 있는 일이
 * 그 자리에 있어야 한다 — 레포를 열어 워크플로우를 찾는 것이 그 답이면 답이 아니다.
 *
 * **끝났는지는 서버가 안다.** 누르면 Actions가 깨어나 1분쯤 뒤 `/api/crawler/ingest`로
 * 보고하고, 그 기록이 이 버튼의 상태를 바꾼다. 그때까지 화면을 몇 번 새로 읽어 결과가
 * 저절로 도착하게 한다 — 눌러 놓고 언제 새로고침할지 사람이 재게 하지 않는다.
 *
 * 다만 **부른 것과 도는 것을 서버는 구별하지 못한다.** crawl_runs에는 끝난 크롤만 남아서,
 * 부르고 5초 뒤의 화면과 아무것도 안 한 화면이 서버에서는 같다. 그래서 "불렀다"는 사실만
 * 이 화면이 기억한다 — 새로고침하면 잊는다. 그 대가로 상태를 하나 더 저장하지 않는다.
 */

/** 크롤은 1분 안팎이다. 15초 간격으로 2분까지 본다 — 그 뒤로는 사람이 새로고침한다 */
const POLL_MS = 15_000;
const POLL_LIMIT = 8;

export function CrawlButton({ state }: { state: CrawlTriggerState }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isWaiting, setIsWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDone = state === "done";

  useEffect(() => {
    // 결과가 도착하면 기다림도 끝난다
    if (isDone) setIsWaiting(false);
  }, [isDone]);

  useEffect(() => {
    if (!isWaiting) return;

    let left = POLL_LIMIT;
    const timer = setInterval(() => {
      left -= 1;
      router.refresh();
      if (left <= 0) {
        clearInterval(timer);
        setIsWaiting(false);
      }
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [isWaiting, router]);

  // 일요일은 크롤이 도는 날이 아니다 — 누를 수 없는 버튼을 놓느니 놓지 않는다
  if (state === "none") return null;

  const busy = isPending || isWaiting;

  const call = () =>
    startTransition(async () => {
      setError(null);
      const result = await requestQtCrawl();

      if (!result.ok) {
        setError(result.reason);
        return;
      }

      setIsWaiting(true);
      router.refresh();
    });

  return (
    <span className="flex items-center gap-2">
      {/* 실패 사유는 버튼 옆에 남는다. 누르면 지워지고 다시 시도할 수 있다 */}
      {error && (
        <button type="button" onClick={() => setError(null)} className="text-(--accent)">
          {error}
        </button>
      )}

      <button
        type="button"
        onClick={call}
        disabled={isDone || busy}
        className="border border-edge px-2 py-0.5 text-faint hover:text-ink disabled:opacity-40 disabled:hover:text-faint"
      >
        {busy ? "가져오는 중…" : crawlTriggerLabel(state)}
      </button>
    </span>
  );
}
