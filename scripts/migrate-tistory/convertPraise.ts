import { PRAISE_SECTION_LABELS } from "@/lib/content/schema";
import { parseYouTubeId, youtubeWatchUrl } from "@/lib/praise/youtube";
import {
  type Block,
  explodeHardBreaks,
  isEmptyBlock,
  lineOf,
  toDoc,
} from "@/scripts/migrate-tistory/blockText";
import { htmlToTiptapContent } from "@/scripts/migrate-tistory/convertHtml";

/**
 * 티스토리 찬양 글 → PraiseContent (05 §6.2 "중상 난이도").
 *
 * 실물의 규칙(픽스처 praise-100):
 *   첫 줄에 유튜브 주소, 그 아래 같은 영상의 iframe
 *   `Intro) 4 Bar` / `1-Chrosu)채우시네 주님이`  섹션 라벨 — 닫는 괄호가 표시다.
 *                                               라벨과 첫 가사가 한 문단에 붙어 있기도 하다
 *   `<hr>` 이후                                  묵상과 기도
 *
 * **라벨은 원문 그대로 남긴다.** `1-Chrosu)`(오타), `3-Verse) Key Up` 같은 표기가 실제로
 * 있는데, 우리 enum(Intro/Verse/Chorus…)에 억지로 맞추면 그 정보가 사라진다. enum과 정확히
 * 같은 이름일 때만 enum을 쓰고, 나머지는 custom으로 적는다(02 §5.4가 그래서 custom을 둔다).
 *
 * 가사는 **손대지 않는다**(01 §1 — 묵상 노동). 줄바꿈만 지킨다.
 */

export type PraiseConversion = {
  content: {
    kind: "PRAISE";
    /** 못 찾으면 **필드를 두지 않는다** — 빈 문자열은 초안 스키마에서도 URL 검사에 걸린다 */
    youtubeUrl?: string;
    sections: { id: string; label: string | { custom: string }; lyrics: string }[];
    meditationAndPrayer: unknown;
  };
  notes: string[];
};

/** `Intro)` `1-Chorus)` `3-Verse) Key Up` — 닫는 괄호까지가 라벨이다 */
const SECTION_LABEL = /^([^()\n]{1,24})\)\s*(.*)$/;

const ENUM_BY_LOWER = new Map(
  PRAISE_SECTION_LABELS.map((label) => [label.toLowerCase(), label] as const),
);

/** 본문 어디에 있든 유튜브 주소를 찾는다 — 평문·링크·iframe 순서가 글마다 다르다 */
function findYouTubeUrl(blocks: unknown[]): string | null {
  const candidates: string[] = [];

  const walk = (node: unknown) => {
    if (typeof node !== "object" || node === null) return;

    const block = node as Block;
    if (typeof block.text === "string") candidates.push(block.text);

    for (const mark of Array.isArray(block.marks) ? (block.marks as Block[]) : []) {
      const href = (mark.attrs as { href?: unknown } | undefined)?.href;
      if (typeof href === "string") candidates.push(href);
    }

    if (Array.isArray(block.content)) for (const child of block.content) walk(child);
  };

  for (const block of blocks) walk(block);

  for (const candidate of candidates) {
    for (const token of candidate.split(/\s+/)) {
      const id = parseYouTubeId(token);
      // 주소 형태를 하나로 모은다 — 같은 영상이 youtu.be·/embed 두 모습으로 들어온다
      if (id) return youtubeWatchUrl(id);
    }
  }

  return null;
}

function labelOf(raw: string): string | { custom: string } {
  const trimmed = raw.trim();
  return ENUM_BY_LOWER.get(trimmed.toLowerCase()) ?? { custom: trimmed };
}

export function convertPraise(bodyHtml: string): PraiseConversion {
  // 가사에서 빈 줄은 절 구분이다 — 여기서만 빈 문단을 남긴다
  const { content: raw, notes: htmlNotes } = htmlToTiptapContent(bodyHtml, {
    keepEmptyParagraphs: true,
  });
  // `<br>`로만 줄을 나눈 글이 섞여 있다 — 구조를 읽기 전에 줄 단위로 편다
  const content = explodeHardBreaks(raw);
  const notes = htmlNotes
    // 임베드는 유튜브 주소로 흡수하므로 노트로 남길 필요가 없다
    .filter((note) => note.kind !== "iframe")
    .map((note) => `${note.kind}: ${note.detail}`);

  const youtubeUrl = findYouTubeUrl(content);
  if (!youtubeUrl) notes.push("유튜브 주소를 찾지 못했습니다");

  const sections: PraiseConversion["content"]["sections"] = [];
  const meditation: unknown[] = [];
  let target: "sections" | "meditation" = "sections";
  let lyrics: string[] | null = null;

  for (const block of content) {
    if ((block as Block).type === "horizontalRule") {
      // 가로선 이후는 묵상과 기도다
      target = "meditation";
      lyrics = null;
      continue;
    }

    if (target === "meditation") {
      if (!isEmptyBlock(block)) meditation.push(block);
      continue;
    }

    if (isEmptyBlock(block)) {
      // 빈 줄은 가사 안의 절 구분이다. 섹션 안에서만 살린다
      if (lyrics && lyrics.length > 0) lyrics.push("");
      continue;
    }

    const line = lineOf(block);

    // 첫 줄의 유튜브 주소는 가사가 아니다
    if (parseYouTubeId(line)) continue;

    const labelled = line.match(SECTION_LABEL);
    if (labelled) {
      lyrics = [];
      sections.push({
        // 순서는 배열 인덱스가 진실이므로(04 §2.5) id는 결정적이면 된다
        id: `section-${sections.length + 1}`,
        label: labelOf(labelled[1]),
        lyrics: "",
      });
      if (labelled[2].trim() !== "") lyrics.push(labelled[2].trim());
      continue;
    }

    if (lyrics) lyrics.push(line);
    else {
      // 라벨 없이 시작하는 가사 — 담을 섹션을 만든다. 내용을 흘리지 않는 것이 먼저다
      lyrics = [line];
      sections.push({ id: `section-${sections.length + 1}`, label: { custom: "" }, lyrics: "" });
    }

    sections[sections.length - 1].lyrics = lyrics.join("\n").replace(/\n+$/, "");
  }

  return {
    content: {
      kind: "PRAISE",
      ...(youtubeUrl ? { youtubeUrl } : {}),
      sections,
      meditationAndPrayer: toDoc(meditation),
    },
    notes,
  };
}
