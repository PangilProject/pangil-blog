import "server-only";

import type { TiptapDoc } from "@/lib/content/schema";
import { highlightCode } from "@/lib/render/highlight";
import { codeKey, collectCodeBlocks } from "@/lib/render/richText";

/**
 * 문서의 코드 블록을 미리 하이라이팅한다 (04 §3.2).
 *
 * 렌더는 동기이고 하이라이팅은 비동기라서 순서를 갈라 놓는다 — 먼저 모아 한 번에 만들고,
 * 렌더는 만들어진 것을 찾아 쓴다. 같은 코드가 두 번 나오면 한 번만 만든다.
 */
export async function highlightDoc(
  doc: TiptapDoc | null | undefined,
): Promise<Map<string, string>> {
  const blocks = collectCodeBlocks(doc);
  if (blocks.length === 0) return new Map();

  const unique = new Map(blocks.map((block) => [codeKey(block), block]));

  const entries = await Promise.all(
    [...unique].map(async ([key, block]) => {
      const html = await highlightCode(block.code, block.language);
      return [key, html] as const;
    }),
  );

  return new Map(entries.filter((entry): entry is [string, string] => entry[1] !== null));
}
