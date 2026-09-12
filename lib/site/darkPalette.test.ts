import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

/**
 * 다크 팔레트 누락 가드 (03 §2.1 · M6).
 *
 * 다크모드가 깨지는 방식은 "색을 잘못 골랐다"가 아니다. **라이트에만 정의된 토큰이 다크에서
 * 라이트 값을 그대로 물려받는 것**이다. 그러면 어두운 지면 위에 크림색 판이 한 장 남고,
 * 글자는 밝은 먹색이 되어 대비가 무너진다 — 질문 시트·주석 상자·카드 그림자가 실제로 그랬다.
 *
 * 조용히 생기는 회귀라서 사람 눈으로만 잡으면 언젠가 놓친다. 그래서 `:root`의 색 토큰이
 * `.dark`에도 있는지 세어 본다.
 */

const CSS_PATH = "app/globals.css";

/**
 * 다크에서 갈지 않아도 되는 토큰. **줄일수록 좋다** — 여기 하나 늘릴 때마다
 * "정말 이 색은 어두운 지면에서도 그대로여도 되나"를 물어야 한다.
 */
const LIGHT_ONLY = new Map([
  /**
   * **면제 사유는 측정해서 적는다.** 한동안 셋 다 "관리 화면은 다크 대상이 아니다"로 적혀
   * 있었는데 그건 사실이 아니다 — `ThemeProvider`가 root layout에 있어 `/admin`에도
   * `.dark`가 걸린다. 틀린 근거로 둔 예외가 진짜 누락을 가려 줬고, 그동안 `완료` 도장이
   * 어두운 지면에서 2.75:1이었다(`--ok`는 이제 다크 값이 있다).
   */
  [
    "--warn",
    "채움·테두리로만 쓴다(점·막대·괘선). 어두운 지면에서 6.93:1이라 그대로 읽힌다. 글자로 쓸 때는 --warn-ink다",
  ],
  [
    "--chrome",
    "관리 헤더의 먹색인데 지금 어느 화면에서도 쓰이지 않는다. 쓰기 시작하면 다크 값을 같이 정한다",
  ],
]);

/** `--name: value;` 중 색을 담은 것만 (hex 또는 rgb) */
function colorTokens(block: string): Set<string> {
  const names = new Set<string>();

  for (const line of block.split(";")) {
    const match = line.replace(/\/\*[\s\S]*?\*\//g, "").match(/(--[\w-]+)\s*:\s*([\s\S]+)/);
    if (!match) continue;

    const [, name, value] = match;
    if (/#[0-9a-f]{3,8}\b|rgb\(/i.test(value)) names.add(name);
  }

  return names;
}

function blockOf(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, `${selector} 블록을 찾지 못했다`).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf("\n}", start));
}

describe("다크 팔레트", () => {
  it(":root의 색 토큰은 .dark에도 있다", async () => {
    const css = await readFile(CSS_PATH, "utf8");

    const light = colorTokens(blockOf(css, ":root"));
    const dark = colorTokens(blockOf(css, ".dark"));

    // 라이트 팔레트가 통째로 사라지면 이 테스트가 공허하게 통과한다
    expect(light.size).toBeGreaterThan(10);

    const missing = [...light].filter((name) => !dark.has(name) && !LIGHT_ONLY.has(name));

    expect(
      missing,
      `다크에서 라이트 값을 물려받는 토큰이 있다 — 어두운 지면에 밝은 판이 남는다: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("예외 목록은 실제로 라이트에 있는 토큰만 담는다", async () => {
    const light = colorTokens(blockOf(await readFile(CSS_PATH, "utf8"), ":root"));

    // 토큰 이름이 바뀌면 예외가 조용히 무의미해진다 — 그러면 진짜 누락을 못 잡는다
    for (const name of LIGHT_ONLY.keys()) expect([...light]).toContain(name);
  });
});
