"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import type { SiteKey } from "@/lib/site/resolveSite";

/**
 * 통계 비콘 (05 §4).
 *
 * UI가 없는 계측 아일랜드다 — 04 §3.6이 세는 "지면 아일랜드 4개"(복사·TOC·YouTube·다크모드)에
 * 들어가지 않는다. 그리는 것이 없으므로 조판을 늘리지 않고, 렌더 트리에도 아무 노드를 남기지
 * 않는다. 그래도 클라이언트 코드가 하나 늘어나는 것은 사실이라 여기 두는 일은 최소로 한다:
 * **읽고, 쏘고, 끝난다.**
 *
 * `fetch`가 아니라 `sendBeacon`이다. 페이지를 떠나는 순간의 요청은 fetch면 취소되고,
 * sendBeacon은 브라우저가 대신 끝까지 보내준다 — LEAVE는 그 순간에만 보낼 수 있다.
 */

type StatBeaconProps = { site: SiteKey };

/**
 * 이보다 짧은 체류는 LEAVE를 보내지 않는다.
 *
 * 개발 모드의 React StrictMode가 effect를 mount→unmount→remount로 두 번 돌려 0ms LEAVE를
 * 하나 만든다(프로덕션에서는 생기지 않는다). 하지만 바닥값을 두는 이유가 그것만은 아니다 —
 * **0.2초 머문 기록은 어디서 생겨도 체류에 대해 아무것도 말해주지 않는다.** 방문 자체는
 * PAGEVIEW가 이미 세었으므로, 여기서 버리는 것은 숫자 하나가 아니라 잡음이다.
 */
const MIN_DURATION_MS = 500;

/**
 * 글 상세 지면은 본문 컨테이너에 `data-post-id`를 달아 둔다. 레이아웃에서 비콘을 한 번만
 * 놓고도 글 단위 통계가 되게 하는 장치다 — 지면마다 비콘을 놓으면 언젠가 두 번 발화한다.
 */
function currentPostId(): string | undefined {
  return document.querySelector<HTMLElement>("[data-post-id]")?.dataset.postId || undefined;
}

function send(body: Record<string, unknown>): void {
  const blob = new Blob([JSON.stringify(body)], { type: "application/json" });

  // sendBeacon이 없거나 큐가 꽉 찼으면(false) 조용히 포기한다. 통계 하나를 살리려고
  // keepalive fetch를 덧붙이면 떠나는 페이지에서 두 번 갈 수 있다
  navigator.sendBeacon?.("/api/stat", blob);
}

export function StatBeacon({ site }: StatBeaconProps) {
  const pathname = usePathname();
  /** LEAVE를 두 번 보내지 않기 위한 문. pagehide와 visibilitychange가 같이 뜰 수 있다 */
  const sentLeave = useRef(false);

  useEffect(() => {
    // 본인 방문도 보낸다. 서버가 쿠키를 보고 표시만 남긴다(05 §4.1) — 여기서 입을 닫으면
    // 그 방문은 기록이 아예 없어서 나중에 "본인 포함"을 셀 수 없다
    const postId = currentPostId();
    const path = pathname;
    const enteredAt = Date.now();
    sentLeave.current = false;

    send({
      site,
      eventType: "PAGEVIEW",
      path,
      postId,
      // 빈 문자열(직접 방문)은 보내지 않는다 — 열에 ""가 쌓이면 null과 구분이 안 된다
      referrer: document.referrer || undefined,
      utmSource: new URLSearchParams(window.location.search).get("utm_source") ?? undefined,
    });

    const leave = () => {
      if (sentLeave.current) return;
      sentLeave.current = true;

      const durationMs = Date.now() - enteredAt;
      if (durationMs < MIN_DURATION_MS) return;

      send({ site, eventType: "LEAVE", path, postId, durationMs });
    };

    /**
     * `pagehide`가 기준이다. 모바일 사파리는 탭을 떠날 때 `unload`를 주지 않고, `beforeunload`는
     * 페이지를 back/forward 캐시에서 빼는 부작용이 있다. 화면이 가려지는 경우(홈으로 나가기)는
     * `visibilitychange`로만 잡히므로 둘을 함께 듣고, 중복은 위의 문이 막는다.
     */
    const onVisibility = () => {
      if (document.visibilityState === "hidden") leave();
    };

    window.addEventListener("pagehide", leave);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("pagehide", leave);
      document.removeEventListener("visibilitychange", onVisibility);
      // 클라이언트 내비게이션으로 이 지면을 벗어나는 경우다. 여기서도 체류를 닫아야
      // 사이트 안에서 여러 글을 읽은 방문이 첫 글만 남지 않는다
      leave();
    };
  }, [pathname, site]);

  return null;
}
