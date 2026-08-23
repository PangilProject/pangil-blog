"use server";

import { withAdmin } from "@/lib/actions/withAdmin";
import { suggestPraiseTitle } from "@/lib/praise/title";
import { parseYouTubeId, youtubeWatchUrl } from "@/lib/praise/youtube";

/**
 * YouTube oEmbed 조회 (00 §7-4 · 02 §5.4).
 *
 * 서버에서 부른다. 브라우저에서 직접 부르면 실패 사유가 콘솔 오류로 새고, 관리 화면에
 * 외부 도메인 호출을 늘리게 된다. 키가 필요 없는 공개 엔드포인트다.
 *
 * **실패는 조용하다.** 제안이 없으면 작성자가 제목을 직접 적으면 되고, 그게 원래
 * 하던 일이다. 여기서 오류 문구를 띄우면 없어도 되는 실패를 만드는 셈이다.
 */

const OEMBED_ENDPOINT = "https://www.youtube.com/oembed";
/** 붙여넣자마자 도는 호출이다. 오래 매달리면 제목 칸이 멍하니 비어 있게 된다 */
const TIMEOUT_MS = 4000;

export type SuggestTitleResult =
  | { ok: true; suggested: string; original: string; authorName: string | null }
  | { ok: false; reason: "not-youtube" | "unavailable" };

type OEmbedResponse = { title?: unknown; author_name?: unknown };

export const suggestTitleFromYouTube = withAdmin(
  async (_user, url: string): Promise<SuggestTitleResult> => {
    const videoId = parseYouTubeId(url);
    if (!videoId) return { ok: false, reason: "not-youtube" };

    const endpoint = `${OEMBED_ENDPOINT}?format=json&url=${encodeURIComponent(
      youtubeWatchUrl(videoId),
    )}`;

    try {
      const response = await fetch(endpoint, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        // 같은 영상을 다시 붙여넣는 일이 잦다(수정 저장). 하루면 충분하다
        next: { revalidate: 86400 },
      });

      if (!response.ok) return { ok: false, reason: "unavailable" };

      const data = (await response.json()) as OEmbedResponse;
      const title = typeof data.title === "string" ? data.title : "";
      if (title === "") return { ok: false, reason: "unavailable" };

      const authorName = typeof data.author_name === "string" ? data.author_name : null;

      return {
        ok: true,
        suggested: suggestPraiseTitle({ title, authorName }),
        original: title,
        authorName,
      };
    } catch {
      // 타임아웃·네트워크 오류·JSON 깨짐 — 전부 "제안 없음"이다
      return { ok: false, reason: "unavailable" };
    }
  },
);
