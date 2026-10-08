import { describe, expect, it } from "vitest";

import { pickWindow } from "@/lib/record/shelfWindow";

describe("pickWindow — 지금 글을 가운데 둔 창", () => {
  it("양쪽이 넉넉하면 둘·둘", () => {
    expect(pickWindow(4, 4)).toEqual({ older: 2, newer: 2 });
  });

  it("가장 새 글이면 지난 글로만 넷", () => {
    expect(pickWindow(4, 0)).toEqual({ older: 4, newer: 0 });
  });

  it("가장 오래된 글이면 새 글로만 넷", () => {
    expect(pickWindow(0, 4)).toEqual({ older: 0, newer: 4 });
  });

  it("한쪽이 하나뿐이면 다른 쪽이 셋", () => {
    expect(pickWindow(4, 1)).toEqual({ older: 3, newer: 1 });
    expect(pickWindow(1, 4)).toEqual({ older: 1, newer: 3 });
  });

  it("축 전체가 넷보다 적으면 있는 만큼만", () => {
    expect(pickWindow(1, 1)).toEqual({ older: 1, newer: 1 });
    expect(pickWindow(0, 0)).toEqual({ older: 0, newer: 0 });
  });
});
