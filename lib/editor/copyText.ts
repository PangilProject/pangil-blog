import type { PostContent } from "@/lib/content/schema";
import { postToMarkdown } from "@/lib/render/postText";

/**
 * 지금 적힌 글을 글자 한 덩이로 — 에디터 `전체 복사` (A-05).
 *
 * 요약을 부탁하려고 **다른 도구에 붙여넣는** 용도다. 큐티에서 먼저 생겼고(칸마다 따로 긁어
 * 이어붙이던 일), 설교·찬양·기술 글도 같은 일을 해서 네 에디터가 이 함수 하나를 쓴다.
 *
 * 조판은 `postToMarkdown`이 정한다. 내보내기 파일과 같은 함수다 — 두 벌 적으면 한쪽만
 * 고쳐지고, 그러면 "내보낸 파일과 복사한 글자가 다르다"가 된다. 여기서 더하는 것은
 * **글 제목** 하나뿐이다(제목은 content가 아니라 posts.title에 산다).
 */
export function copyTextOf(title: string, content: PostContent): string {
  const heading = title.trim();

  return [heading === "" ? "" : `# ${heading}`, postToMarkdown(content)]
    .filter((part) => part !== "")
    .join("\n\n");
}
