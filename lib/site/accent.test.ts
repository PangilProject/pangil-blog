import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

/**
 * 3면 무드 오버라이드의 가드 (03 §2.1 · 프리모템 #12 · 07 §4 출시 게이트).
 *
 * "액센트 1축만 바꾼다"는 규칙은 주석으로만 지켜지고 있었다. 이 규칙이 무너지는 방식은
 * 극적이지 않다 — 어느 날 dev만 조금 다른 배경을 갖고, 다음 달에 faith만 다른 테두리를
 * 갖는다. 그러면 하나를 고치려고 셋을 고치게 되고, 그게 프리모템 #12가 말한 실패다.
 *
 * 그래서 CSS를 읽어 **`[data-site=...]` 블록이 무엇을 선언하는지** 직접 본다. 규칙을 늘리려면
 * 이 테스트를 먼저 고쳐야 하고, 그 자리에서 "정말 1축을 깨야 하나"를 한 번 더 묻게 된다.
 */

const CSS_PATH = "app/globals.css";

/** `[data-site="dev"] { … }` 블록의 선언부만 뽑는다 */
function siteBlocks(css: string): { selector: string; declarations: string[] }[] {
  const blocks: { selector: string; declarations: string[] }[] = [];
  const pattern = /\[data-site=(?:"|')?([\w-]+)(?:"|')?\]\s*\{([^}]*)\}/g;

  for (const match of css.matchAll(pattern)) {
    const declarations = match[2]
      .split(";")
      .map((line) => line.replace(/\/\*[\s\S]*?\*\//g, "").trim())
      .filter((line) => line.length > 0)
      .map((line) => line.split(":")[0].trim());

    blocks.push({ selector: match[1], declarations });
  }

  return blocks;
}

describe("3면 무드 오버라이드", () => {
  it("data-site 블록은 --accent 하나만 바꾼다", async () => {
    const blocks = siteBlocks(await readFile(CSS_PATH, "utf8"));

    // 오버라이드가 아예 사라지면 dev가 잉크 블루를 잃는다 — 그것도 회귀다
    expect(blocks.length).toBeGreaterThan(0);

    for (const block of blocks) {
      expect(block.declarations, `[data-site="${block.selector}"]`).toEqual(["--accent"]);
    }
  });

  it("hub와 faith는 오버라이드를 갖지 않는다 — 기본 팔레트를 공유한다(03 §2.1)", async () => {
    const selectors = siteBlocks(await readFile(CSS_PATH, "utf8")).map((block) => block.selector);

    expect(selectors).not.toContain("hub");
    expect(selectors).not.toContain("faith");
  });
});
