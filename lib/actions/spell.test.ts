import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 맞춤법 액션의 경계 — 길이 상한, 마감, 고장 알림. 검사기와 알림은 바꿔 끼운다.
 * 관리자 가드(withAdmin) 자체는 withAdmin.test가 본다.
 */
const mocks = vi.hoisted(() => ({
  checkWithDaum: vi.fn(),
  noteSpellCheckerBroken: vi.fn(),
}));

vi.mock("@/lib/actions/withAdmin", () => ({
  withAdmin:
    <Args extends unknown[], Result>(action: (user: unknown, ...args: Args) => Promise<Result>) =>
    (...args: Args) =>
      action({ id: "admin" }, ...args),
}));
vi.mock("@/lib/notify/spellChecker", () => ({
  noteSpellCheckerBroken: mocks.noteSpellCheckerBroken,
}));
vi.mock("@/lib/spell/daum", async () => {
  class SpellCheckerBrokenError extends Error {}
  return { checkWithDaum: mocks.checkWithDaum, SpellCheckerBrokenError };
});

const { checkSpelling } = await import("@/lib/actions/spell");
const { SpellCheckerBrokenError } = await import("@/lib/spell/daum");

beforeEach(() => {
  mocks.checkWithDaum.mockReset();
  mocks.noteSpellCheckerBroken.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("checkSpelling", () => {
  it("2만 자를 넘으면 보내지 않는다", async () => {
    const result = await checkSpelling(["가".repeat(10_000), "나".repeat(10_001)]);

    expect(result).toEqual({ ok: false, reason: "too-long" });
    expect(mocks.checkWithDaum).not.toHaveBeenCalled();
  });

  it("결과를 글자열 안의 자리로 돌려준다", async () => {
    mocks.checkWithDaum.mockResolvedValue([
      { type: "spell", token: "되서", suggestion: "돼서", context: "되서 기쁘다", info: null },
    ]);

    const result = await checkSpelling(["오늘", "되서 기쁘다"]);

    expect(result).toEqual({
      ok: true,
      typos: [
        {
          type: "spell",
          token: "되서",
          suggestion: "돼서",
          info: null,
          segment: 1,
          from: 0,
          to: 2,
        },
      ],
    });
  });

  it("검사기가 고장 났으면 거슬림 목록에 적는다", async () => {
    mocks.checkWithDaum.mockRejectedValue(new SpellCheckerBrokenError("HTTP 403"));

    const result = await checkSpelling(["되서"]);

    expect(result).toEqual({ ok: false, reason: "failed" });
    expect(mocks.noteSpellCheckerBroken).toHaveBeenCalledOnce();
  });

  it("잠깐 끊긴 것은 적지 않는다 — 다시 누르면 된다", async () => {
    mocks.checkWithDaum.mockRejectedValue(new Error("fetch failed"));

    const result = await checkSpelling(["되서"]);

    expect(result).toEqual({ ok: false, reason: "failed" });
    expect(mocks.noteSpellCheckerBroken).not.toHaveBeenCalled();
  });
});
