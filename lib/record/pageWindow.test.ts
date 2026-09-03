import { describe, expect, it } from "vitest";

import { PAGE_WINDOW, pageWindow } from "@/lib/record/pageWindow";

describe("pageWindow — 목록 페이지 번호 창", () => {
  it("전체가 창보다 적으면 있는 것만 놓는다", () => {
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(1, 1)).toEqual([1]);
  });

  it("현재 페이지를 창 가운데에 둔다", () => {
    expect(pageWindow(22, 43)).toEqual([20, 21, 22, 23, 24]);
  });

  it("앞쪽에서는 1부터 시작한다 — 0페이지를 만들지 않는다", () => {
    expect(pageWindow(1, 43)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(2, 43)).toEqual([1, 2, 3, 4, 5]);
  });

  it("끝에서도 창 폭을 유지한다 — 번호 하나만 남으면 갈 곳이 없어 보인다", () => {
    expect(pageWindow(43, 43)).toEqual([39, 40, 41, 42, 43]);
    expect(pageWindow(42, 43)).toEqual([39, 40, 41, 42, 43]);
  });

  it("범위 밖 페이지는 가장 가까운 자리로 붙인다 — URL로 직접 들어온 값이다", () => {
    expect(pageWindow(0, 43)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(999, 43)).toEqual([39, 40, 41, 42, 43]);
    expect(pageWindow(Number.NaN, 43)).toEqual([1, 2, 3, 4, 5]);
  });

  it("글이 없으면 빈 창이다", () => {
    expect(pageWindow(1, 0)).toEqual([]);
  });

  it("창 폭은 기본 5다", () => {
    expect(pageWindow(10, 20)).toHaveLength(PAGE_WINDOW);
  });
});
