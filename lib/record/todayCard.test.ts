import { describe, expect, it } from "vitest";

import { editorPath, type TodayPost, todayCardState, todayCardTypes } from "@/lib/record/todayCard";

const createdAt = new Date("2026-08-23T21:00:00Z");

function draft(overrides: Partial<TodayPost> = {}): TodayPost {
  return {
    id: "post-1",
    status: "DRAFT",
    title: "초안",
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

describe("todayCardState (02 §3.1)", () => {
  it("아무것도 없으면 빈 카드다", () => {
    expect(todayCardState({ post: null })).toBe("empty");
  });

  it("크롤러가 채워둔 초안은 손대기 전까지 '초안 도착'이다", () => {
    expect(todayCardState({ post: draft(), crawl: { status: "SUCCESS", postId: "post-1" } })).toBe(
      "draft-ready",
    );
  });

  it("한 번이라도 저장했으면 '작성 중'이다", () => {
    const touched = draft({ updatedAt: new Date(createdAt.getTime() + 5000) });

    expect(todayCardState({ post: touched, crawl: { status: "SUCCESS", postId: "post-1" } })).toBe(
      "writing",
    );
  });

  it("손으로 시작한 초안은 크롤과 무관하게 '작성 중'이다", () => {
    expect(todayCardState({ post: draft(), crawl: null })).toBe("writing");
    // 크롤이 만든 초안이 아니면 같은 시각이어도 사람이 만든 것이다
    expect(todayCardState({ post: draft(), crawl: { status: "SUCCESS", postId: "other" } })).toBe(
      "writing",
    );
  });

  it("발행했으면 완료다", () => {
    expect(todayCardState({ post: draft({ status: "PUBLISHED" }) })).toBe("published");
  });

  it("크롤이 실패하고 초안도 없으면 수동 폴백을 안내한다 (프리모템 #1)", () => {
    expect(todayCardState({ post: null, crawl: { status: "FAILED", postId: null } })).toBe(
      "crawl-failed",
    );
  });

  it("콘텐츠 없는 날(SKIPPED)은 실패가 아니다", () => {
    expect(todayCardState({ post: null, crawl: { status: "SKIPPED", postId: null } })).toBe(
      "empty",
    );
  });
});

describe("todayCardTypes", () => {
  it("월~토는 큐티와 찬양이다", () => {
    expect(todayCardTypes(new Date("2026-08-24T05:00:00Z"))).toEqual(["QT", "PRAISE"]);
  });

  it("일요일은 설교와 찬양이다", () => {
    expect(todayCardTypes(new Date("2026-08-23T05:00:00Z"))).toEqual(["SERMON", "PRAISE"]);
  });
});

describe("editorPath", () => {
  it("타입과 초안 id로 경로를 만든다", () => {
    expect(editorPath("QT")).toBe("/admin/write/qt");
    expect(editorPath("SERMON", "abc")).toBe("/admin/write/sermon/abc");
  });
});
