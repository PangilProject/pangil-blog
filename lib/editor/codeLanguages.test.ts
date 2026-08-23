import { describe, expect, it } from "vitest";

import {
  CODE_LANGUAGES,
  codeLanguageLabel,
  normalizeCodeLanguage,
} from "@/lib/editor/codeLanguages";
import { LANGUAGE_LOADERS } from "@/lib/render/highlight";

describe("코드 언어 목록", () => {
  /**
   * 에디터에서 고를 수 있는 언어와 하이라이터가 문법을 싣는 언어가 어긋나면 "고를 수는 있는데
   * 색이 안 입는 언어"가 생긴다. 두 목록이 같다는 것을 여기서 고정한다.
   */
  it("고를 수 있는 언어는 모두 문법이 실려 있다", () => {
    for (const language of CODE_LANGUAGES) {
      expect(LANGUAGE_LOADERS[language.value]).toBeTypeOf("function");
    }
  });

  it("문법이 실린 언어는 모두 고를 수 있다", () => {
    const selectable = new Set(CODE_LANGUAGES.map((language) => language.value));

    for (const key of Object.keys(LANGUAGE_LOADERS)) {
      expect(selectable.has(key as never)).toBe(true);
    }
  });
});

describe("normalizeCodeLanguage", () => {
  it("별칭을 모은다", () => {
    expect(normalizeCodeLanguage("TypeScript")).toBe("ts");
    expect(normalizeCodeLanguage("shell")).toBe("bash");
    expect(normalizeCodeLanguage("postgresql")).toBe("sql");
  });

  it("모르는 언어·빈 값은 null이다", () => {
    expect(normalizeCodeLanguage("klingon")).toBeNull();
    expect(normalizeCodeLanguage("")).toBeNull();
    expect(normalizeCodeLanguage(null)).toBeNull();
  });
});

describe("codeLanguageLabel", () => {
  it("아는 언어는 표기를 다듬는다", () => {
    expect(codeLanguageLabel("typescript")).toBe("TypeScript");
    expect(codeLanguageLabel("sql")).toBe("SQL");
  });

  it("모르는 언어는 적힌 그대로 보여준다 — 지우면 정보가 사라진다", () => {
    expect(codeLanguageLabel("klingon")).toBe("klingon");
  });

  it("언어가 없으면 라벨도 없다", () => {
    expect(codeLanguageLabel(null)).toBeNull();
    expect(codeLanguageLabel("  ")).toBeNull();
  });
});
