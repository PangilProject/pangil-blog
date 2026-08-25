import { describe, expect, it } from "vitest";

import { classify } from "@/scripts/migrate-tistory/classify";

/**
 * 실제 백업의 카테고리 문자열을 그대로 넣는다 — 이모지가 `?`로 깨진 모습까지.
 * 다음 백업에서 이모지가 또 다르게 깨져도 통과해야 한다.
 */

describe("classify — faith", () => {
  it("QT", () => {
    expect(classify("?? 묵상/? QT(날솟샘)")).toEqual({
      kind: "post",
      site: "faith",
      type: "QT",
      categorySlug: null,
    });
  });

  it("설교 — 살아남은 이모지가 섞여 있어도 읽는다", () => {
    expect(classify("?? 묵상/⛪️ 설교")).toMatchObject({ site: "faith", type: "SERMON" });
  });

  it("찬양은 하위가 앨범·팀 이름이라 전부 PRAISE다", () => {
    for (const path of ["? 찬양/어노인팅", "? 찬양/FIA 워십", "? 찬양", "? 찬양/GIFTED"]) {
      expect(classify(path)).toMatchObject({ site: "faith", type: "PRAISE" });
    }
  });

  it("묵상 하위를 모르면 검토 큐다 — 추측해서 QT로 넣지 않는다", () => {
    expect(classify("?? 묵상")).toMatchObject({ kind: "review" });
  });

  /** 두 번째 블로그(2025-09-21~)는 묵상만 담아서 QT·설교가 최상위다 */
  it("QT·설교가 최상위여도 같은 곳으로 간다", () => {
    expect(classify("? QT")).toMatchObject({ site: "faith", type: "QT" });
    expect(classify("⛪️ 설교")).toMatchObject({ site: "faith", type: "SERMON" });
  });

  it("세이레 특별새벽기도회는 설교다 (사용자 확인, 2026-08-25)", () => {
    expect(classify("다니엘세이레 특별새벽기도회")).toMatchObject({
      site: "faith",
      type: "SERMON",
    });
  });
});

describe("classify — dev", () => {
  it("상위 카테고리로 우리 분류에 매핑한다", () => {
    expect(classify("??‍? FE/? Next.js")).toMatchObject({ type: "TECH", categorySlug: "fe" });
    expect(classify("??‍? BE/? MySQL")).toMatchObject({ categorySlug: "be" });
    expect(classify("? 개발/??‍? 코테")).toMatchObject({ categorySlug: "dev" });
    expect(classify("✍? 회고/? 우테코")).toMatchObject({ categorySlug: "retrospective" });
    expect(classify("? 정보 공유")).toMatchObject({ categorySlug: "info" });
    expect(classify("? 한동대학교/일반화학")).toMatchObject({ categorySlug: "school" });
    expect(classify("? 프로젝트/☄️ 트러블 슈팅")).toMatchObject({ categorySlug: "dev" });
  });

  it("BE 아래여도 K9s·Docker·AWS는 인프라다", () => {
    expect(classify("??‍? BE/? K9s")).toMatchObject({ categorySlug: "infra" });
    expect(classify("??‍? BE/?  Docker")).toMatchObject({ categorySlug: "infra" });
    expect(classify("??‍? BE/?️ AWS")).toMatchObject({ categorySlug: "infra" });
  });

  it("하위 없는 상위도 읽는다", () => {
    expect(classify("??‍? FE")).toMatchObject({ categorySlug: "fe" });
    expect(classify("✍? 회고")).toMatchObject({ categorySlug: "retrospective" });
  });
});

describe("classify — 이관하지 않는 것", () => {
  it("카테고리가 비면 규칙으로 못 가른다 — overrides가 글 단위로 정한다", () => {
    expect(classify("")).toEqual({ kind: "review", reason: "카테고리 없음" });
  });

  it("미사용 카테고리는 검토 큐다", () => {
    expect(classify("미사용/캡스톤디자인2")).toMatchObject({ kind: "review" });
  });

  it("모르는 카테고리를 TECH로 흘리지 않는다", () => {
    expect(classify("? 새로운분류/무엇")).toMatchObject({ kind: "review" });
  });
});
