import { describe, expect, it } from "vitest";

import { EMPTY_TIPTAP_DOC } from "@/lib/content/schema";
import { parseDraftContent, parsePublishContent } from "@/lib/db/content";

describe("Json 경계 (ADR-002)", () => {
  it("DB에서 나온 값을 타입 붙은 content로 바꾼다", () => {
    const result = parseDraftContent({ kind: "SERMON", scriptureRef: "전도서 9장" });

    expect(result.ok).toBe(true);
    if (result.ok && result.content.kind === "SERMON") {
      expect(result.content.scriptureRef).toBe("전도서 9장");
    }
  });

  it("실패를 삼키지 않고 사유와 원본을 함께 돌려준다 — 호출자가 폴백을 고른다(04 §2.4)", () => {
    const raw = { kind: "PRAISE", youtubeUrl: "nope" };
    const result = parseDraftContent(raw);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.join()).toContain("youtubeUrl");
      expect(result.raw).toBe(raw);
    }
  });

  it("발행 경로는 구조가 갖춰져야 통과한다", () => {
    const incomplete = { kind: "TECH" };
    expect(parsePublishContent(incomplete).ok).toBe(false);
    expect(parsePublishContent({ kind: "TECH", body: EMPTY_TIPTAP_DOC }).ok).toBe(true);
  });

  it("모르는 kind는 어느 경로로도 통과하지 않는다", () => {
    expect(parseDraftContent({ kind: "DIARY" }).ok).toBe(false);
    expect(parsePublishContent(null).ok).toBe(false);
  });
});
