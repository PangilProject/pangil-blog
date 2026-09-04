import { describe, expect, it } from "vitest";

import {
  CATEGORY_NAME_MAX,
  suggestCategorySlug,
  validateCategoryInput,
} from "@/lib/record/category";

describe("validateCategoryInput", () => {
  it("이름과 주소가 갖춰지면 통과한다", () => {
    expect(validateCategoryInput({ name: "회고", slug: "retrospective" })).toBeNull();
    expect(validateCategoryInput({ name: "CS", slug: "cs" })).toBeNull();
    expect(validateCategoryInput({ name: "웹 보안", slug: "web-security" })).toBeNull();
  });

  it("빈 값을 막는다 — 공백만 적은 것도 빈 값이다", () => {
    expect(validateCategoryInput({ name: "   ", slug: "cs" })?.field).toBe("name");
    expect(validateCategoryInput({ name: "CS", slug: "  " })?.field).toBe("slug");
  });

  it("주소는 영문 소문자·숫자·하이픈만 받는다 — 그 값이 공개 URL이 된다", () => {
    for (const slug of ["CS", "웹보안", "web security", "-fe", "fe-", "fe--be", "fe/be"]) {
      expect(validateCategoryInput({ name: "이름", slug })?.field).toBe("slug");
    }
  });

  it("길이를 넘기면 사유를 돌려준다", () => {
    const long = "가".repeat(CATEGORY_NAME_MAX + 1);
    expect(validateCategoryInput({ name: long, slug: "cs" })?.message).toContain(
      `${CATEGORY_NAME_MAX}자`,
    );
  });
});

describe("suggestCategorySlug", () => {
  it("영문 이름은 그대로 주소가 된다", () => {
    expect(suggestCategorySlug("Web Security")).toBe("web-security");
  });

  it("한글 이름은 빈 문자열이다 — 뜻을 옮기는 일은 사람이 한다", () => {
    expect(suggestCategorySlug("회고")).toBe("");
  });
});
