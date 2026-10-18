import { describe, expect, it } from "vitest";

import {
  checkSegments,
  chunkSegments,
  locateTypos,
  SpellDeadlineError,
  type SpellTypo,
  toSegmentTypos,
} from "@/lib/spell/locate";

function typo(token: string, suggestion: string, context = token, type = "spell"): SpellTypo {
  return { type, token, suggestion, context, info: null };
}

describe("locateTypos", () => {
  it("token의 자리를 찾는다", () => {
    const text = "다시 시작할 수 있게 되서 감사하다.";

    expect(locateTypos(text, [typo("되서", "돼서")])).toMatchObject([
      { token: "되서", from: 12, to: 14 },
    ]);
  });

  it("같은 말이 두 번 나오면 context가 자리를 가른다", () => {
    const text = "일이 되서 기뻤다. 다시 되서 감사하다.";
    const located = locateTypos(text, [typo("되서", "돼서", "다시 되서 감사하다.")]);

    expect(located).toHaveLength(1);
    expect(located[0].from).toBe(text.lastIndexOf("되서"));
  });

  it("같은 말의 오류가 둘이면 앞자리부터 하나씩 차지한다", () => {
    const text = "되서 좋고 되서 기쁘다.";
    const located = locateTypos(text, [typo("되서", "돼서"), typo("되서", "돼서")]);

    expect(located.map((item) => item.from)).toEqual([0, 6]);
  });

  it("결과의 순서가 뒤섞여 와도 문서 순서로 돌려준다", () => {
    const text = "몇일 동안 묵상을 안했다.";
    const located = locateTypos(text, [typo("안했다.", "안 했다."), typo("몇일", "며칠")]);

    expect(located.map((item) => item.token)).toEqual(["몇일", "안했다."]);
  });

  it("context가 원문과 어긋나면 token만으로 찾는다", () => {
    const text = "마음이  편해 졌다.";
    const located = locateTypos(text, [typo("편해 졌다.", "편해졌다.", "마음이 편해 졌다.")]);

    expect(located).toMatchObject([{ from: 5 }]);
  });

  it("원문에 없는 token은 버린다 — 엉뚱한 자리에 긋지 않는다", () => {
    expect(locateTypos("감사합니다.", [typo("금새", "금세")])).toEqual([]);
  });

  it("빈 token은 버린다", () => {
    expect(locateTypos("감사합니다.", [typo("", "x")])).toEqual([]);
  });
});

describe("chunkSegments", () => {
  it("한도 안에서 문단을 줄바꿈으로 이어 붙인다", () => {
    expect(chunkSegments(["가나", "다라", "마"], 6)).toEqual([
      { segments: [0, 1], offsets: [0, 3], lengths: [2, 2], text: "가나\n다라" },
      { segments: [2], offsets: [0], lengths: [1], text: "마" },
    ]);
  });

  it("한도를 넘는 문단은 혼자 한 덩어리가 된다", () => {
    const long = "가".repeat(12);

    expect(chunkSegments(["나", long, "다"], 10).map((chunk) => chunk.segments)).toEqual([
      [0],
      [1],
      [2],
    ]);
  });

  it("문단이 없으면 덩어리도 없다", () => {
    expect(chunkSegments([])).toEqual([]);
  });
});

describe("toSegmentTypos", () => {
  it("덩어리 안의 자리를 문단 안의 자리로 돌린다", () => {
    const [chunk] = chunkSegments(["오늘은 좋다.", "몇일 쉬었다."]);
    const located = locateTypos(chunk.text, [typo("몇일", "며칠")]);

    expect(toSegmentTypos(chunk, located)).toEqual([
      { type: "spell", token: "몇일", suggestion: "며칠", info: null, segment: 1, from: 0, to: 2 },
    ]);
  });

  it("이음매를 걸친 것은 버린다", () => {
    const [chunk] = chunkSegments(["감사", "드린다"]);
    const located = locateTypos(chunk.text, [typo("감사\n드린다", "감사드린다")]);

    expect(toSegmentTypos(chunk, located)).toEqual([]);
  });
});

describe("checkSegments", () => {
  it("덩어리마다 검사기를 한 번씩, 차례로 부른다", async () => {
    const calls: string[] = [];
    const check = async (text: string) => {
      calls.push(text);
      return text.includes("되서") ? [typo("되서", "돼서")] : [];
    };

    const result = await checkSegments(["가".repeat(995), "일이 되서 기쁘다.", "나"], check, {
      concurrency: 1,
    });

    expect(calls).toHaveLength(2);
    expect(result).toEqual([
      { type: "spell", token: "되서", suggestion: "돼서", info: null, segment: 1, from: 3, to: 5 },
    ]);
  });
});

describe("checkSegments — 동시성과 마감", () => {
  const block = (char: string) => char.repeat(999);

  it("정해진 수만큼만 동시에 보낸다", async () => {
    let running = 0;
    let peak = 0;
    const check = async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running -= 1;
      return [];
    };

    await checkSegments([block("가"), block("나"), block("다"), block("라"), block("마")], check, {
      concurrency: 2,
    });

    expect(peak).toBe(2);
  });

  it("먼저 끝난 덩어리와 무관하게 문서 순서로 돌려준다", async () => {
    // 앞 덩어리가 더 늦게 끝난다
    const check = async (text: string) => {
      await new Promise((resolve) => setTimeout(resolve, text.startsWith("되서") ? 20 : 1));
      return [typo("되서", "돼서")];
    };

    const result = await checkSegments(
      [`되서${"가".repeat(997)}`, `되서${"나".repeat(997)}`],
      check,
    );

    expect(result.map((item) => item.segment)).toEqual([0, 1]);
  });

  it("남은 시간을 요청 하나의 상한으로 넘긴다", async () => {
    const timeouts: number[] = [];
    let clock = 0;

    await checkSegments(
      [block("가"), block("나")],
      async (_text, timeoutMs) => {
        timeouts.push(timeoutMs);
        clock += 3000;
        return [];
      },
      { concurrency: 1, deadlineMs: 5000, requestTimeoutMs: 8000, now: () => clock },
    );

    expect(timeouts).toEqual([5000, 2000]);
  });

  it("마감을 넘기면 통째로 실패한다 — 반쪽 결과는 나머지가 다 맞다는 뜻이 된다", async () => {
    let clock = 0;
    const check = async () => {
      clock += 6000;
      return [typo("되서", "돼서")];
    };

    await expect(
      checkSegments([block("가"), block("나")], check, {
        concurrency: 1,
        deadlineMs: 5000,
        now: () => clock,
      }),
    ).rejects.toBeInstanceOf(SpellDeadlineError);
  });
});
