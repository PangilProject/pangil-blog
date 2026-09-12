import { describe, expect, it } from "vitest";

import { loginErrorMessage } from "@/lib/auth/loginError";

describe("loginErrorMessage", () => {
  it("빈 칸과 틀린 비밀번호는 다른 말을 한다 — 다음에 할 일이 다르다", () => {
    expect(loginErrorMessage("empty")).toContain("적어주세요");
    expect(loginErrorMessage("invalid")).toContain("확인해 주세요");
  });

  it("사유가 없으면 아무 말도 하지 않는다", () => {
    expect(loginErrorMessage(null)).toBeNull();
    expect(loginErrorMessage("")).toBeNull();
  });

  it("모르는 사유도 조용히 넘기지 않는다 — 무슨 일이 있었다는 것은 말한다", () => {
    expect(loginErrorMessage("무엇인가")).toBe(loginErrorMessage("invalid"));
  });
});
