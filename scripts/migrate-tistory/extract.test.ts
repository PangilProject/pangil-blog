import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  ExtractError,
  extractPost,
  kstTextToDate,
  legacyIdOf,
  parseTags,
} from "@/scripts/migrate-tistory/extract";

/**
 * 픽스처는 실제 백업 파일 그대로다(05 §6.7 "실물 1개로 셀렉터 핀 고정").
 * 타입별 대표 한 편씩 두고, 스킨 마크업이 바뀌면 여기서 먼저 붉어지게 한다.
 */

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}.html`, import.meta.url), "utf-8");
}

describe("legacyIdOf", () => {
  it("파일명 앞 숫자가 원본 글 ID다", () => {
    expect(legacyIdOf("105/105-[혼자공부하는SQL]-12강.html")).toBe(105);
    // 제목 없이 저장된 글도 있다
    expect(legacyIdOf("542/542.html")).toBe(542);
  });

  it("숫자로 시작하지 않으면 던진다", () => {
    expect(() => legacyIdOf("style.css")).toThrow(ExtractError);
  });
});

describe("kstTextToDate", () => {
  it("티스토리가 적은 시각은 KST다 — 실행 환경 타임존으로 읽지 않는다", () => {
    // 2024-12-01 16:47:46 KST = 07:47:46 UTC
    expect(kstTextToDate("2024-12-01 16:47:46").toISOString()).toBe("2024-12-01T07:47:46.000Z");
  });

  it("자정 전 시각이 전날 UTC로 넘어간다", () => {
    expect(kstTextToDate("2025-01-01 08:30:00").toISOString()).toBe("2024-12-31T23:30:00.000Z");
  });

  it("형식이 다르면 던진다", () => {
    expect(() => kstTextToDate("2024/12/01")).toThrow(ExtractError);
  });
});

describe("parseTags", () => {
  it("태그 안에 공백이 있어도 #로 쪼개면 정확하다", () => {
    expect(parseTags("#QT #묵상 #날마다 솟는 샘물 #날솟샘")).toEqual([
      "QT",
      "묵상",
      "날마다 솟는 샘물",
      "날솟샘",
    ]);
  });

  it("슬래시가 든 곡 제목도 한 태그다", () => {
    expect(parseTags("#어노인팅 #채우시네 / 내 영이 / 기뻐하라")).toEqual([
      "어노인팅",
      "채우시네 / 내 영이 / 기뻐하라",
    ]);
  });

  it("태그가 없으면 빈 배열", () => {
    expect(parseTags("\n                            ")).toEqual([]);
  });
});

describe("extractPost", () => {
  it("QT 글의 메타를 읽는다", () => {
    const post = extractPost(fixture("qt-101"), "101/101-복음의-씨를.html");

    expect(post.legacyId).toBe(101);
    expect(post.title).toBe("복음의 씨를 뿌려 하나님 나라를 확장하라");
    expect(post.categoryPath).toContain("QT");
    expect(post.publishedAt.toISOString().slice(0, 10)).toBe("2025-02-18");
    expect(post.tags).toContain("날마다 솟는 샘물");
    expect(post.bodyHtml).toContain("내용관찰");
  });

  it("찬양 글은 본문에 유튜브 주소와 iframe이 함께 있다", () => {
    const post = extractPost(fixture("praise-100"), "100/100-어노인팅.html");

    expect(post.bodyHtml).toContain("youtu.be/w7Twex62gpc");
    expect(post.bodyHtml).toContain("<iframe");
  });

  it("카테고리가 비어 있어도 추출은 성공한다 — 판정은 classify가 한다", () => {
    const post = extractPost(fixture("no-category-10"), "10/10-[설교-서식].html");

    expect(post.categoryPath).toBe("");
    expect(post.title).toBe("[설교 서식]");
  });

  it("본문 컨테이너가 없으면 던진다 — 빈 글을 만들지 않는다", () => {
    expect(() => extractPost("<html><body></body></html>", "1/1-x.html")).toThrow(ExtractError);
  });
});
