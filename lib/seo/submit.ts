import "server-only";

import { notifySlack } from "@/lib/notify/slack";
import type { PublicSite } from "@/lib/revalidate/tags";
import { describeIndexNowStatus, planIndexNow } from "@/lib/seo/indexNow";

/**
 * 발행·삭제 시 검색엔진에 알린다 (06 §8).
 *
 * **지면마다 따로 보낸다.** IndexNow의 `host`는 urlList의 호스트와 일치해야 하고(불일치는 422)
 * dev와 faith는 서로 다른 호스트다. 한 번의 발행은 한 지면만 건드리므로 요청도 하나면 된다.
 *
 * **절대 던지지 않는다.** 발행은 이미 DB에 커밋된 뒤다 — 여기서 예외가 나면 글은 발행됐는데
 * 화면은 실패를 보여주게 된다. 검색엔진 통보 실패는 "나중에 크롤러가 알아서 온다"로 끝나는
 * 일이고, 발행을 되돌릴 이유가 전혀 없다.
 *
 * 성공은 조용하다. 실패만 Slack으로 간다(06 §4의 알림 정책 그대로) — 매 발행마다 알림이 오면
 * 그 채널을 안 보게 되고, 그러면 정작 실패했을 때도 안 본다.
 */
export async function submitToSearchEngines(site: PublicSite, urls: string[]): Promise<void> {
  const plan = planIndexNow({
    key: process.env.INDEXNOW_KEY,
    siteHost: site === "dev" ? process.env.SITE_HOST_DEV : process.env.SITE_HOST_FAITH,
    urls,
  });

  if (!plan.submit) {
    // 도메인 미확정(`no-domain`)은 **아직 안 하기로 한 일**이라 조용히 넘어간다. 매 발행마다
    // 한 줄씩 남기면 그게 곧 실패처럼 읽히고, 정작 진짜 문제를 가린다.
    //
    // 키가 없는 것(`no-key`)은 다르다 — 도메인은 붙었는데 키를 안 넣은 설정 실수이므로 남긴다.
    if (plan.reason === "no-key") {
      console.warn(
        "[indexnow] INDEXNOW_KEY가 없어 검색엔진 제출을 건너뜁니다 (.env.example 참조).",
      );
    }
    return;
  }

  const count = plan.request.body.urlList.length;

  try {
    const response = await fetch(plan.request.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(plan.request.body),
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) return;

    await notifySlack(
      `IndexNow 제출 실패 — ${describeIndexNowStatus(response.status)} (${count}건)`,
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : "알 수 없는 오류";
    await notifySlack(`IndexNow 제출 실패 — ${reason} (${count}건)`);
  }
}
