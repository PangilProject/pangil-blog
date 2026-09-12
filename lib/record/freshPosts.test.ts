import { describe, expect, it } from "vitest";

import { freshPostIds } from "@/lib/record/freshPosts";

/**
 * **시각으로 재지 않는다.** 공개 목록은 캐시되고 그 캐시는 글이 발행될 때 갈린다 —
 * 렌더 중에 "오늘"을 읽으면 어제 만든 HTML이 오늘도 "오늘"이라고 적혀 있게 된다.
 */
const at = (iso: string) => new Date(iso);

describe("freshPostIds", () => {
  it("가장 최근 발행일의 글들을 고른다", () => {
    const ids = freshPostIds([
      { id: "a", publishedAt: at("2026-09-12T01:00:00Z") },
      { id: "b", publishedAt: at("2026-09-12T09:00:00Z") },
      { id: "c", publishedAt: at("2026-09-10T01:00:00Z") },
    ]);

    expect([...ids].sort()).toEqual(["a", "b"]);
  });

  it("날짜는 한국 시간으로 가른다 — 발행 시각은 UTC로 저장된다", () => {
    // 2026-09-11T16:00Z = 한국 시간 9월 12일 새벽 1시
    const ids = freshPostIds([
      { id: "밤", publishedAt: at("2026-09-11T16:00:00Z") },
      { id: "낮", publishedAt: at("2026-09-12T03:00:00Z") },
    ]);

    expect(ids.size).toBe(2);
  });

  it("발행 안 된 글은 세지 않는다", () => {
    const ids = freshPostIds([
      { id: "초안", publishedAt: null },
      { id: "발행", publishedAt: at("2026-09-12T01:00:00Z") },
    ]);

    expect([...ids]).toEqual(["발행"]);
  });

  it("빈 목록은 빈 집합이다", () => {
    expect(freshPostIds([]).size).toBe(0);
    expect(freshPostIds([{ id: "a", publishedAt: null }]).size).toBe(0);
  });
});
