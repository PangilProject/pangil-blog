import {
  type Block,
  explodeHardBreaks,
  isEmptyBlock,
  lineOf,
  toDoc,
} from "@/scripts/migrate-tistory/blockText";
import { htmlToTiptapContent } from "@/scripts/migrate-tistory/convertHtml";

/**
 * 티스토리 설교 글 → SermonContent (05 §6.2 "중간 난이도").
 *
 * 실물의 규칙(픽스처 sermon-1):
 *   `<blockquote><b>빌립보서 4장 8~9절</b></blockquote>`  말씀 범위
 *   `<ol><li>끝으로 형제들아…</li></ol>`                   절 — 목록으로 적혀 있다
 *   `<hr>`                                                말씀과 속기의 경계
 *   그 뒤 전부                                             본문(라이브 속기)
 *   `Summary` 이후                                         예배 후 요약(있을 때만)
 *
 * 말씀 범위와 본문의 경계를 `<hr>`로 잡는다. hr이 없는 글은 **절로 보이지 않는 첫 줄**까지를
 * 말씀으로 보고 나머지를 본문으로 넘긴다 — 본문을 말씀 칸에 밀어 넣는 것보다 안전하다.
 */

const SUMMARY_HEADINGS = new Set(["summary", "요약", "예배후요약", "정리"]);

/** `26.` `8~9.` 처럼 번호로 시작하는 줄 */
const VERSE_LINE = /^\d+(?:\s*[-~]\s*\d+)?\s*[.)]/;

export type SermonConversion = {
  content: {
    kind: "SERMON";
    scriptureRef: string;
    scriptureBody: string;
    body: unknown;
    summary?: unknown;
  };
  notes: string[];
};

/** 목록은 항목마다 한 줄이다 — 절이 `<ol><li>`로 적혀 있는 글이 많다 */
function linesOf(block: unknown): string[] {
  const node = block as Block;

  const MULTILINE = ["bulletList", "orderedList", "blockquote"];
  if (node.type && MULTILINE.includes(node.type) && Array.isArray(node.content)) {
    return (node.content as unknown[]).flatMap(linesOf).filter((line) => line !== "");
  }

  const line = lineOf(block);
  return line === "" ? [] : [line];
}

function isSummaryHeading(line: string): boolean {
  return SUMMARY_HEADINGS.has(
    line
      .replace(/\s+/g, "")
      .replace(/[[\]()]/g, "")
      .toLowerCase(),
  );
}

export function convertSermon(bodyHtml: string): SermonConversion {
  const { content: raw, notes: htmlNotes } = htmlToTiptapContent(bodyHtml);
  // `<br>`로만 줄을 나눈 글이 섞여 있다 — 구조를 읽기 전에 줄 단위로 편다
  const content = explodeHardBreaks(raw);
  const notes = htmlNotes.map((note) => `${note.kind}: ${note.detail}`);

  const scriptureLines: string[] = [];
  const body: unknown[] = [];
  const summary: unknown[] = [];

  let scriptureRef = "";
  let target: "scripture" | "body" | "summary" = "scripture";

  for (const block of content) {
    if (isEmptyBlock(block)) continue;

    const line = lineOf(block);

    if (isSummaryHeading(line)) {
      target = "summary";
      continue;
    }

    if (target === "summary") {
      summary.push(block);
      continue;
    }

    if (target === "body") {
      body.push(block);
      continue;
    }

    // 말씀 영역
    if ((block as Block).type === "horizontalRule") {
      target = "body";
      continue;
    }

    if (scriptureRef === "") {
      // 인용 블록 하나에 범위와 절이 함께 들어 있는 글이 있다 — 첫 줄만 범위로 떼고
      // 나머지는 절로 남긴다. 통째로 범위에 담으면 본문이 빈 글이 된다
      const [head, ...rest] = linesOf(block);
      scriptureRef = head ?? line;
      scriptureLines.push(...rest);
      continue;
    }

    const lines = linesOf(block);
    // 절이 아닌 줄이 나오면 거기서부터 본문이다(hr이 없는 글)
    if (lines.length > 0 && !VERSE_LINE.test(lines[0]) && (block as Block).type === "paragraph") {
      target = "body";
      body.push(block);
      continue;
    }

    scriptureLines.push(...lines);
  }

  return {
    content: {
      kind: "SERMON",
      scriptureRef,
      scriptureBody: scriptureLines.join("\n"),
      body: toDoc(body),
      ...(summary.length > 0 ? { summary: toDoc(summary) } : {}),
    },
    notes,
  };
}
