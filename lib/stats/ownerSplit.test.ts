import { describe, expect, it } from "vitest";

import { splitOf } from "@/lib/stats/ownerSplit";

const row = (isOwner: boolean, n: number) => ({
  isOwner,
  today: n,
  yesterday: n * 2,
  thisWeek: n * 4,
  total: n * 3,
});

/**
 * 공개 지면은 본인 것도 세고(`all`), 관리 화면은 밖에서 온 것만 본다(`others`).
 * 그 갈림이 이 함수 하나에 있다 — 여기가 틀리면 두 화면의 숫자가 서로를 반박한다.
 */
describe("splitOf", () => {
  it("합계는 본인과 남을 더한 값이다", () => {
    expect(splitOf([row(false, 10), row(true, 1)]).all).toEqual({
      today: 11,
      yesterday: 22,
      thisWeek: 44,
      total: 33,
    });
  });

  it("남만은 본인을 빼고 남는다", () => {
    expect(splitOf([row(false, 10), row(true, 1)]).others).toEqual({
      today: 10,
      yesterday: 20,
      thisWeek: 40,
      total: 30,
    });
  });

  /** 본인이 아직 안 온 날 — 그 줄이 아예 없다 */
  it("본인 줄이 없어도 합계가 온전하다", () => {
    const { all, others } = splitOf([row(false, 10)]);

    expect(all).toEqual(others);
    expect(all.total).toBe(30);
  });

  /** 남이 아직 안 온 날 — 공개 지면에는 내 방문만 적힌다 */
  it("남의 줄이 없으면 남만은 0이다", () => {
    const { all, others } = splitOf([row(true, 2)]);

    expect(all.total).toBe(6);
    expect(others).toEqual({ today: 0, yesterday: 0, thisWeek: 0, total: 0 });
  });

  it("아무 줄도 없으면 둘 다 0이다", () => {
    const { all, others } = splitOf([]);

    expect(all).toEqual({ today: 0, yesterday: 0, thisWeek: 0, total: 0 });
    expect(others).toEqual({ today: 0, yesterday: 0, thisWeek: 0, total: 0 });
  });
});
