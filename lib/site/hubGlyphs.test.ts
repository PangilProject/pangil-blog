import { describe, expect, it } from "vitest";

import { splitIntoGlyphs } from "@/lib/site/hubGlyphs";

describe("splitIntoGlyphs", () => {
  it("낱말로 가르고 낱자로 쪼갠다", () => {
    const words = splitIntoGlyphs("고치고, 다시 묻는다.");

    expect(words).toHaveLength(3);
    expect(words[0].glyphs.map((g) => g.char).join("")).toBe("고치고,");
    expect(words[2].glyphs.map((g) => g.char).join("")).toBe("묻는다.");
  });

  it("마지막 낱말 뒤에는 공백을 두지 않는다", () => {
    const words = splitIntoGlyphs("두 낱말");

    expect(words[0].trailingSpace).toBe(true);
    expect(words[1].trailingSpace).toBe(false);
  });

  it("같은 글자가 거듭 나와도 키가 겹치지 않는다", () => {
    const keys = splitIntoGlyphs("다시 다시").flatMap((w) => w.glyphs.map((g) => g.key));

    expect(new Set(keys).size).toBe(keys.length);
  });

  it("쪼갠 것을 도로 붙이면 원문이다", () => {
    const line = "만든 것은 쓰이기 전까지 가정이다.";
    const restored = splitIntoGlyphs(line)
      .map((w) => w.glyphs.map((g) => g.char).join("") + (w.trailingSpace ? " " : ""))
      .join("");

    expect(restored).toBe(line);
  });

  it("빈 문자열에서도 터지지 않는다", () => {
    expect(splitIntoGlyphs("")).toEqual([{ key: "w0", glyphs: [], trailingSpace: false }]);
  });
});
