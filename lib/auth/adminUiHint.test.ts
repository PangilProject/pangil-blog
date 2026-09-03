import { describe, expect, it } from "vitest";

import { ADMIN_UI_COOKIE, hasAdminUiHint } from "@/lib/auth/adminUiHint";

describe("hasAdminUiHint — 공개 지면의 관리 컨트롤 노출", () => {
  it("힌트가 있으면 참이다", () => {
    expect(hasAdminUiHint(`${ADMIN_UI_COOKIE}=1`)).toBe(true);
    expect(hasAdminUiHint(`theme=dark; ${ADMIN_UI_COOKIE}=1; stat_optout=1`)).toBe(true);
  });

  it("없으면 거짓이다", () => {
    expect(hasAdminUiHint("theme=dark")).toBe(false);
    expect(hasAdminUiHint("")).toBe(false);
    expect(hasAdminUiHint(undefined)).toBe(false);
  });

  it("이름이 겹치는 다른 쿠키에 속지 않는다", () => {
    expect(hasAdminUiHint("not_admin_ui=1")).toBe(false);
    expect(hasAdminUiHint(`${ADMIN_UI_COOKIE}=0`)).toBe(false);
  });
});
