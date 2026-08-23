import { describe, expect, it } from "vitest";

import { highlightCode, resolveLanguage } from "@/lib/render/highlight";

/**
 * 하이라이팅은 서버 렌더 시점에 끝난다(04 §3.2). 여기서 고정하는 것은 두 가지다.
 * 1. 언어 표기가 제각각이어도(붙여넣은 마크다운) 같은 문법으로 모인다
 * 2. **모르는 언어가 코드를 못 보이게 만들지 않는다** — 그때는 null이고 평문으로 그린다
 */
describe("resolveLanguage", () => {
  it("별칭을 같은 문법으로 모은다", () => {
    expect(resolveLanguage("TypeScript")).toBe("ts");
    expect(resolveLanguage("shell")).toBe("bash");
    expect(resolveLanguage("postgresql")).toBe("sql");
  });

  it("모르는 언어·빈 값은 null이다", () => {
    expect(resolveLanguage("brainfuck")).toBeNull();
    expect(resolveLanguage(null)).toBeNull();
    expect(resolveLanguage("  ")).toBeNull();
  });
});

describe("highlightCode", () => {
  it("아는 언어는 색이 입혀진 HTML이 된다", async () => {
    const html = await highlightCode("const a = 1;", "ts");

    expect(html).toContain("<pre");
    expect(html).toContain("const");
    // 먹지 테마 배경이 실려야 한다(03 §3.2)
    expect(html?.toLowerCase()).toContain("#2b2823");
  });

  it("언어를 모르면 null — 코드는 평문으로 그려진다", async () => {
    expect(await highlightCode("무엇", "klingon")).toBeNull();
    expect(await highlightCode("무엇", null)).toBeNull();
  });

  it("별칭으로 불러도 같은 결과다 — ts와 typescript가 갈리지 않는다", async () => {
    const first = await highlightCode("const a = 1;", "ts");
    const second = await highlightCode("const a = 1;", "typescript");

    expect(second).toBe(first);
  });
});
