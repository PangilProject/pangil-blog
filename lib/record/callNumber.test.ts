import { describe, expect, it } from "vitest";

import {
  CALL_NUMBER_DIGITS,
  formatCallNumber,
  padCallNumber,
  RECORD_TYPES,
} from "@/lib/record/callNumber";
import { PostType } from "@/prisma/generated/enums";

describe("formatCallNumber — 03 §6.3 표기 매핑", () => {
  it("묵상 3타입은 프리픽스와 네 자리 번호로 적는다", () => {
    expect(formatCallNumber({ type: "QT", callNumber: 1043 })).toBe("QT-1043");
    expect(formatCallNumber({ type: "SERMON", callNumber: 104 })).toBe("SR-0104");
    expect(formatCallNumber({ type: "PRAISE", callNumber: 388 })).toBe("PR-0388");
  });

  it("TECH는 프리픽스 없이 번호와 카테고리를 병기한다", () => {
    expect(formatCallNumber({ type: "TECH", callNumber: 72, categoryName: "회고" })).toBe(
      "0072 · 회고",
    );
  });

  it("TECH에 카테고리가 없으면 번호만 적는다", () => {
    expect(formatCallNumber({ type: "TECH", callNumber: 72 })).toBe("0072");
    expect(formatCallNumber({ type: "TECH", callNumber: 72, categoryName: null })).toBe("0072");
  });

  it("번호가 없는 초안은 null이다 — 무엇을 보여줄지는 화면이 정한다", () => {
    expect(formatCallNumber({ type: "QT", callNumber: null })).toBeNull();
    expect(
      formatCallNumber({ type: "TECH", callNumber: undefined, categoryName: "FE" }),
    ).toBeNull();
  });

  it("네 자리를 넘으면 자르지 않는다 — 청구기호는 이력이라 잘리면 안 된다", () => {
    expect(formatCallNumber({ type: "QT", callNumber: 12345 })).toBe("QT-12345");
  });

  it("카테고리 이름이 비어 있으면 병기하지 않는다", () => {
    expect(formatCallNumber({ type: "TECH", callNumber: 1, categoryName: "" })).toBe("0001");
  });
});

describe("padCallNumber", () => {
  it("최소 자리수를 0으로 채운다", () => {
    expect(padCallNumber(1)).toBe("0001");
    expect(padCallNumber(1043)).toBe("1043");
    expect(padCallNumber(1)).toHaveLength(CALL_NUMBER_DIGITS);
  });
});

describe("RECORD_TYPES", () => {
  it("Prisma PostType과 같은 집합이다 — 한쪽만 늘어나는 드리프트를 막는다", () => {
    expect([...RECORD_TYPES].sort()).toEqual(Object.keys(PostType).sort());
  });
});
