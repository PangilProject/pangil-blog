import { describe, expect, it } from "vitest";

import { safeNextPath } from "@/lib/auth/nextPath";

describe("safeNextPath — 로그인 후 돌아갈 곳", () => {
  it("관리 영역 경로는 통과한다", () => {
    expect(safeNextPath("/admin/edit/sr-12")).toBe("/admin/edit/sr-12");
    expect(safeNextPath("/admin/posts?type=TECH")).toBe("/admin/posts?type=TECH");
  });

  it("다른 호스트로 나가는 주소를 막는다 — 열린 리다이렉트", () => {
    expect(safeNextPath("//evil.com")).toBeNull();
    expect(safeNextPath("https://evil.com")).toBeNull();
    // 브라우저가 백슬래시를 슬래시로 고쳐 읽는다
    expect(safeNextPath("/\\evil.com")).toBeNull();
    expect(safeNextPath("/admin/\\evil.com")).toBeNull();
  });

  it("관리 영역 밖은 막는다 — 로그인 후 갈 곳은 관리 화면뿐이다", () => {
    expect(safeNextPath("/faith/sr-12")).toBeNull();
    expect(safeNextPath("/admin")).toBeNull();
  });

  it("로그인 화면 자신은 막는다 — 그러면 갇힌다", () => {
    expect(safeNextPath("/admin/login")).toBeNull();
    expect(safeNextPath("/admin/login?error=invalid")).toBeNull();
  });

  it("빈 값과 값 아닌 것은 null이다", () => {
    expect(safeNextPath("")).toBeNull();
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
  });
});
