import "server-only";

import { noteUnreachable } from "@/lib/notify/unreachable";

/**
 * Slack 알림 (06 §1.1 — "crawl_runs 기록과 Slack 알림을 서버 경로에 단일화").
 *
 * 웹훅 시크릿은 Vercel env에만 있고 Actions에는 없다. 그래서 크롤러는 결과만 보고하고
 * 알림은 항상 여기서 나간다 — 알림 경로가 한 곳이면 "알림이 왜 안 왔지"를 한 곳에서 본다.
 *
 * **알림 실패가 크롤을 죽이지 않는다.** 이 함수는 절대 throw하지 않는다. 초안은 이미
 * 만들어졌고, 알림을 못 보낸 것이 그 초안을 되돌릴 이유는 없다.
 *
 * **대신 실패를 눈에 보이는 곳에 남긴다**(`noteUnreachable`). 여태는 `console.error`로 끝났고
 * 그 로그는 아무도 안 본다 — 조용한 채널의 약점은 **웹훅이 죽어도 똑같이 조용하다**는 것이다.
 * 정상과 고장이 화면에서 구분되지 않으면 이 채널에 건 프리모템 #1 방어가 무의미해진다.
 *
 * 소음 관리: 실패는 항상 보내고, 성공·미게시는 기본으로 보내지 않는다. 매일 아침 오는
 * 🟢를 사람이 읽지 않게 되면 정작 🔴도 같이 흘려버린다(프리모템 #1의 실제 실패 모드).
 * 가동률을 눈으로 보고 싶은 기간에는 `SLACK_VERBOSE=on`으로 켠다.
 */

const TIMEOUT_MS = 5000;

export type NotifyOptions = {
  /** 성공·미게시처럼 "잘 돌고 있다"는 알림. SLACK_VERBOSE=on일 때만 나간다 */
  quiet?: boolean;
};

export async function notifySlack(text: string, { quiet = false }: NotifyOptions = {}) {
  if (quiet && process.env.SLACK_VERBOSE !== "on") return { sent: false, reason: "quiet" as const };

  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (!webhook) {
    // 로컬·프리뷰에는 웹훅이 없는 게 정상이다. 그래도 콘솔에는 남긴다
    console.warn(`[slack] SLACK_WEBHOOK_URL 미설정 — 알림을 건너뜁니다: ${text}`);
    return { sent: false, reason: "no-webhook" as const };
  }

  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error(`[slack] ${response.status} — 알림 실패: ${text}`);
      await noteUnreachable(`Slack이 ${response.status}을 돌려줬어요`);
      return { sent: false, reason: "http-error" as const };
    }

    return { sent: true, reason: null };
  } catch (error) {
    console.error(`[slack] 알림 실패: ${text}`, error);
    await noteUnreachable("Slack에 닿지 못했어요");
    return { sent: false, reason: "network-error" as const };
  }
}
