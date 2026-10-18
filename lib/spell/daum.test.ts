import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 다음 검사기 경계. 실제 요청은 보내지 않는다 — hanspell을 바꿔 끼우고, 콜백 셋(check·end·
 * error)을 우리가 Promise 하나로 제대로 묶는지만 본다.
 */
const hanspell = vi.hoisted(() => ({ spellCheckByDAUM: vi.fn() }));
vi.mock("hanspell", () => hanspell);

const { checkWithDaum, SpellCheckerBrokenError, toSpellTypo } = await import("@/lib/spell/daum");

type Callbacks = [
  text: string,
  timeout: number,
  check: (found: unknown[]) => void,
  end: () => void,
  error: (err: unknown) => void,
];

beforeEach(() => {
  hanspell.spellCheckByDAUM.mockReset();
});

// 실제 응답(2026-10-18)에서 옮긴 항목
const RAW = {
  type: "spell",
  token: "되서",
  suggestions: ["돼서"],
  context: "감사 드리는 날이 였다. 되서 기쁘다.",
  info: "'ㅚ'로 끝나는 용언 어간에 어미 '-어(-었)'가 준 형태로 '돼서'를 씁니다.",
};

describe("toSpellTypo", () => {
  it("첫 제안을 고칠 말로 쓴다", () => {
    expect(toSpellTypo(RAW)).toEqual({
      type: "spell",
      token: "되서",
      suggestion: "돼서",
      context: RAW.context,
      info: RAW.info,
    });
  });

  it("설명이 없으면 null이다", () => {
    expect(toSpellTypo({ ...RAW, info: undefined })?.info).toBeNull();
  });

  it("제안이 없거나 원문과 같으면 버린다", () => {
    expect(toSpellTypo({ ...RAW, suggestions: [] })).toBeNull();
    expect(toSpellTypo({ ...RAW, suggestions: ["되서"] })).toBeNull();
  });

  it("모양이 어긋나면 버린다 — 남의 HTML을 긁은 값이다", () => {
    expect(toSpellTypo({ token: "되서" })).toBeNull();
    expect(toSpellTypo(null)).toBeNull();
  });
});

describe("checkWithDaum", () => {
  it("여러 번 오는 결과를 모아 끝날 때 돌려준다", async () => {
    hanspell.spellCheckByDAUM.mockImplementation((...[, , check, end]: Callbacks) => {
      check([RAW]);
      check([{ ...RAW, token: "금새", suggestions: ["금세"] }, { broken: true }]);
      end();
    });

    const typos = await checkWithDaum("...", 5000);

    expect(typos.map((typo) => typo.token)).toEqual(["되서", "금새"]);
  });

  it("받은 시간 상한을 hanspell에 그대로 넘긴다", async () => {
    hanspell.spellCheckByDAUM.mockImplementation((...[, , , end]: Callbacks) => end());

    await checkWithDaum("...", 1234);

    expect(hanspell.spellCheckByDAUM.mock.calls[0][1]).toBe(1234);
  });

  it.each([["invalid response"], ["HTTP 403"]])(
    "%s는 저절로 낫지 않는 고장이다",
    async (message) => {
      hanspell.spellCheckByDAUM.mockImplementation((...[, , , end, error]: Callbacks) => {
        error(new Error(message));
        end();
      });

      await expect(checkWithDaum("...", 5000)).rejects.toBeInstanceOf(SpellCheckerBrokenError);
    },
  );

  it("타임아웃·네트워크 끊김은 고장으로 보지 않는다 — 다시 누르면 된다", async () => {
    hanspell.spellCheckByDAUM.mockImplementation((...[, , , end, error]: Callbacks) => {
      error(new DOMException("This operation was aborted", "AbortError"));
      end();
    });

    const failure = await checkWithDaum("...", 5000).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toBeInstanceOf(SpellCheckerBrokenError);
  });

  it("일부라도 실패하면 전체를 실패로 본다", async () => {
    hanspell.spellCheckByDAUM.mockImplementation((...[, , check, end, error]: Callbacks) => {
      check([RAW]);
      error(new Error("HTTP 503"));
      end();
    });

    await expect(checkWithDaum("...", 5000)).rejects.toThrow("HTTP 503");
  });
});
