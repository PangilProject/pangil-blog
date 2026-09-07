"use server";

import { withAdmin } from "@/lib/actions/withAdmin";
import { praiseMeditationBlocks } from "@/lib/content/schema";
import { findEditablePost } from "@/lib/db/posts";
import type { HiddenMeditationBlock } from "@/lib/praise/meditation";
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

/**
 * 발행된 찬양 글의 **감춘 묵상 덩이**를 읽는다 (02 §5.4).
 *
 * 공개 상세는 통째로 캐시되므로(`use cache`, ADR-003) 감춘 글자를 그 HTML에 실을 수 없다 —
 * 실으면 캐시 항목 하나가 모든 방문자에게 그대로 나가고, 그건 감춘 것이 아니다. 그래서
 * **본인이 보고 있을 때만 따로 받아 간다.**
 *
 * `수정`·`삭제`처럼 힌트 쿠키로 그릴 수는 없다. 그 둘은 **버튼**이라 흉내 내도 서버가
 * 막으면 되지만, 이건 **내용**이라 화면에 그리는 순간 끝이다. 그래서 여기가 실제 게이트다 —
 * `withAdmin`이 세션을 확인한다(05 §3.2).
 */
export const loadHiddenMeditation = withAdmin(
  async (_user, postId: string): Promise<HiddenMeditationBlock[]> => {
    const post = await findEditablePost(postId);
    // 스키마를 통과하지 못한 글은 감춘 덩이를 가릴 수도 없다 — 없는 것으로 답한다
    if (!post?.content.ok || post.content.content.kind !== "PRAISE") return [];

    return praiseMeditationBlocks(post.content.content.meditationAndPrayer)
      .map((block, index) => ({ index, doc: block.doc, hidden: block.hidden }))
      .filter((block) => block.hidden)
      .map(({ index, doc }) => ({ index, doc }));
  },
);
