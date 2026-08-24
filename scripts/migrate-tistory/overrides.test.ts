import { describe, expect, it } from "vitest";

import { overrideFor } from "@/scripts/migrate-tistory/overrides";

/**
 * 32편의 손 판정. 표가 조용히 줄어드는 것을 막는다 — 한 줄이 사라지면 그 글은
 * 검토 큐로 떨어지고, 리포트는 "아직 준비 안 됨"으로 실패한다.
 */

describe("overrideFor", () => {
  it("카테고리를 빼먹은 묵상 글을 타입까지 정해준다", () => {
    expect(overrideFor(519)).toMatchObject({ site: "faith", type: "QT" });
    // "주일 예배 설교"인데 티스토리에서 QT로 분류돼 있었다
    expect(overrideFor(320)).toMatchObject({ site: "faith", type: "SERMON" });
    expect(overrideFor(523)).toMatchObject({ site: "faith", type: "PRAISE" });
  });

  it("학교 수업·특강·업무일지는 학교로", () => {
    for (const id of [134, 163, 166, 167, 168, 330, 69, 71, 85, 102]) {
      expect(overrideFor(id)).toMatchObject({ type: "TECH", categorySlug: "school" });
    }
  });

  it("문제 풀이·리팩토링 글은 개발로", () => {
    for (const id of [124, 416, 629, 622]) {
      expect(overrideFor(id)).toMatchObject({ categorySlug: "dev" });
    }
  });

  it("나머지 개별 판정", () => {
    expect(overrideFor(542)).toMatchObject({ categorySlug: "infra" });
    expect(overrideFor(556)).toMatchObject({ categorySlug: "cs" });
    expect(overrideFor(557)).toMatchObject({ categorySlug: "cs" });
    expect(overrideFor(568)).toMatchObject({ categorySlug: "retrospective" });
    expect(overrideFor(640)).toMatchObject({ categorySlug: "info" });
    expect(overrideFor(641)).toMatchObject({ categorySlug: "info" });
  });

  it("서식은 제외한다 — 발행하면 빈 글이 공개된다", () => {
    // 137 수요 채플은 "말씀 / 1. / Summary :"만 있는 빈 틀이었다
    for (const id of [4, 10, 17, 66, 70, 95, 137, 660, 661, 662]) {
      expect(overrideFor(id)).toEqual({ kind: "exclude", reason: "서식·빈 틀" });
    }
  });

  it("표에 없는 글은 규칙에 맡긴다", () => {
    expect(overrideFor(105)).toBeNull();
  });
});
