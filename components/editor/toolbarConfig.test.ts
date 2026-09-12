import { describe, expect, it } from "vitest";

import {
  BLOCK_COMMANDS_BY_VARIANT,
  BLOCK_STYLE_LABELS,
  BLOCK_STYLES_BY_VARIANT,
  MARK_COMMANDS_BY_VARIANT,
} from "@/components/editor/EditorToolbar";
import { CODE_LANGUAGES } from "@/lib/editor/codeLanguages";

describe("툴바 구성 차등 — 03 §5.3", () => {
  it("full(기술·큐티)은 문단 스타일 5종을 모두 낸다", () => {
    expect(BLOCK_STYLES_BY_VARIANT.full).toEqual(["p", "h2", "h3", "blockquote", "pre"]);
  });

  it("slim(설교·찬양)은 코드 블록·제목1을 빼고 줄인다 — 라이브 속기 방해 금지", () => {
    expect(BLOCK_STYLES_BY_VARIANT.slim).not.toContain("pre");
    expect(BLOCK_STYLES_BY_VARIANT.slim).not.toContain("h2");
    expect(BLOCK_STYLES_BY_VARIANT.slim).toContain("blockquote");
  });

  it("slim의 서식은 굵게만 남긴다", () => {
    expect(MARK_COMMANDS_BY_VARIANT.slim).toEqual(["bold"]);
    expect(MARK_COMMANDS_BY_VARIANT.full).toEqual(["bold", "italic", "underline"]);
  });

  it("slim에는 구분선이 없다", () => {
    expect(BLOCK_COMMANDS_BY_VARIANT.slim).not.toContain("horizontalRule");
    expect(BLOCK_COMMANDS_BY_VARIANT.full).toContain("horizontalRule");
  });

  it("full은 번호 목록과 표까지 낸다 — 기술 글이 실제로 쓰는 것들이다", () => {
    expect(BLOCK_COMMANDS_BY_VARIANT.full).toContain("orderedList");
    expect(BLOCK_COMMANDS_BY_VARIANT.full).toContain("table");
  });

  it("slim에는 번호 목록도 표도 없다 — 그 자리에서 손이 멈출 것을 늘리지 않는다", () => {
    expect(BLOCK_COMMANDS_BY_VARIANT.slim).not.toContain("orderedList");
    expect(BLOCK_COMMANDS_BY_VARIANT.slim).not.toContain("table");
  });

  it("모든 문단 스타일에 한국어 라벨이 있다", () => {
    for (const style of BLOCK_STYLES_BY_VARIANT.full) {
      expect(BLOCK_STYLE_LABELS[style]).toBeTruthy();
    }
  });
});

describe("코드 언어 선택 (02 §5.5)", () => {
  it("고를 수 있는 언어가 목록에 있다", () => {
    expect(CODE_LANGUAGES.map((language) => language.value)).toContain("ts");
    expect(CODE_LANGUAGES.map((language) => language.value)).toContain("bash");
  });
});
