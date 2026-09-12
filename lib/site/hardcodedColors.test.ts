import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * 화면 코드의 색 하드코딩 래칫 (03 §2.1 · 04 §3.6.1).
 *
 * `darkPalette.test.ts`가 **CSS 토큰**이 다크에 빠졌는지 센다. 그런데 M6가 그 가드를 붙인 뒤에도
 * 같은 고장이 **TSX 안의 하드코딩**으로 되살아났다 — 가드가 자기 대상의 한 층 위만 봤다.
 * 실제로 도장 바탕(`bg-[rgb(255_255_255_/_60%)]`)이 그렇게 새어 나가 공개 지면에 섰다.
 *
 * **여기서 하는 일은 "다 고쳐라"가 아니라 "더 늘지 마라"다.** 아래 목록은 지금 남아 있는 빚이고,
 * 하나하나가 "이 색은 어두운 지면에서 어떻게 되나"를 아직 안 물어본 자리다. 새로 생기면 빨개진다.
 *
 * **목록이 줄면 여기도 같이 줄인다** — 줄었는데 그대로 두면 다음 사람이 "아직 남아 있다"고 읽는다.
 */

/** 파일 → 그 파일이 들고 있는 색 리터럴. **늘리지 않는다.** */
const BASELINE: Record<string, string[]> = {
  "components/editor/CodeBlockNodeView.tsx": ["#3a3630", "#C7B58A"],
  "components/editor/CrawlBand.tsx": ["#6e5d38", "#98835a", "#efe3c8"],
  "components/editor/EditorToolbar.tsx": ["#4e483c", "#a79c86", "#c9a98a", "#dcd4c2"],
  "components/editor/PraiseSectionList.tsx": ["#c4bcaa", "#ede5d3"],
  "components/editor/QtEditor.tsx": ["#b98f4f", "#dcc9b8", "#fbf5ec"],
  "components/editor/SaveIndicator.tsx": ["#cfc8b6"],
  "components/public/CodeBlock.tsx": ["#3a3630", "#8B8474", "#F3EFE4"],
};

/** Tailwind 임의값으로 박힌 색. `bg-[#...]` · `text-[rgb(...)]` 같은 것들 */
const COLOR_LITERAL =
  /(?:bg|text|border|fill|stroke|ring|outline|shadow|from|to|via|decoration|caret|accent)-\[(#[0-9a-fA-F]{3,8}|rgba?\([^\]]*\))\]/g;

async function tsxFiles(dir: string, out: string[] = []): Promise<string[]> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await tsxFiles(path, out);
    else if (entry.name.endsWith(".tsx") && !entry.name.includes(".test.")) out.push(path);
  }
  return out;
}

async function scan(): Promise<Record<string, string[]>> {
  const found: Record<string, string[]> = {};

  for (const dir of ["components", "app"]) {
    for (const path of await tsxFiles(dir)) {
      const source = await readFile(path, "utf8");
      const hits = [...source.matchAll(COLOR_LITERAL)].map((match) => match[1]);
      if (hits.length > 0) found[path] = [...new Set(hits)].sort();
    }
  }

  return found;
}

describe("화면 코드의 색 하드코딩", () => {
  it("새로 늘지 않는다 — 토큰을 쓰면 테마가 따라오고, 박으면 라이트 값이 다크에 남는다", async () => {
    const found = await scan();

    const added: string[] = [];
    for (const [path, colors] of Object.entries(found)) {
      const allowed = new Set(BASELINE[path] ?? []);
      for (const color of colors) {
        if (!allowed.has(color)) added.push(`${path} → ${color}`);
      }
    }

    expect(added, "토큰을 쓸 수 없는 자리라면 BASELINE에 근거와 함께 더한다").toEqual([]);
  });

  it("목록이 줄면 같이 줄인다 — 고쳐 놓고 그대로 두면 다음 사람이 아직 남았다고 읽는다", async () => {
    const found = await scan();

    const gone: string[] = [];
    for (const [path, colors] of Object.entries(BASELINE)) {
      const still = new Set(found[path] ?? []);
      for (const color of colors) {
        if (!still.has(color)) gone.push(`${path} → ${color}`);
      }
    }

    expect(gone, "고쳤으면 BASELINE에서도 지운다").toEqual([]);
  });
});
