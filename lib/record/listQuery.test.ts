import { describe, expect, it } from "vitest";

import { listCacheTags, listWhere } from "@/lib/record/listQuery";

/**
 * 목록 다섯 갈래(홈·타입별·카테고리별·태그별·검색)가 한 조건 함수를 공유한다. 그래서 이
 * 함수만 맞으면 어느 갈래에서도 초안·비공개가 새지 않는다 — 그게 여기서 고정할 첫 번째다.
 */
describe("listWhere — 공개 조건", () => {
  it("항상 PUBLISHED만 본다", () => {
    expect(listWhere({ site: "faith" }).status).toBe("PUBLISHED");
    expect(listWhere({ site: "dev", query: "무엇" }).status).toBe("PUBLISHED");
    expect(listWhere({ site: "faith", tag: "은혜" }).status).toBe("PUBLISHED");
  });

  it("지면 밖 타입은 섞이지 않는다", () => {
    expect(listWhere({ site: "dev" }).type).toEqual({ in: ["TECH"] });
    expect(listWhere({ site: "faith" }).type).toEqual({ in: ["QT", "SERMON", "PRAISE"] });
  });

  it("타입 필터는 그 타입만 남긴다", () => {
    expect(listWhere({ site: "faith", type: "QT" }).type).toBe("QT");
  });

  it("검색어는 searchText 부분 매칭이다 (05 §4A)", () => {
    expect(listWhere({ site: "faith", query: " 전도서 " })).toMatchObject({
      searchText: { contains: "전도서", mode: "insensitive" },
    });
  });

  it("빈 검색어는 조건에 넣지 않는다 — 넣으면 전체 목록이 빈 문자열 매칭이 된다", () => {
    expect(listWhere({ site: "faith", query: "   " })).not.toHaveProperty("searchText");
    expect(listWhere({ site: "faith" })).not.toHaveProperty("searchText");
  });

  it("카테고리·태그 조건은 각각 관계로 건다", () => {
    expect(listWhere({ site: "dev", categorySlug: "fe" })).toMatchObject({
      category: { slug: "fe" },
    });
    expect(listWhere({ site: "faith", tag: "은혜" })).toMatchObject({
      tags: { some: { tag: { name: "은혜" } } },
    });
  });
});

describe("listCacheTags — 무효화 대상 (04 §1.2)", () => {
  it("목록 태그는 항상 붙는다", () => {
    expect(listCacheTags({ site: "faith" })).toEqual(["list:faith"]);
  });

  it("부분집합 뷰는 자기 태그로도 무효화된다", () => {
    expect(listCacheTags({ site: "faith", type: "QT" })).toEqual(["list:faith", "list:faith:QT"]);
    expect(listCacheTags({ site: "dev", categorySlug: "fe" })).toEqual(["list:dev", "list:dev:fe"]);
    expect(listCacheTags({ site: "faith", tag: "은혜" })).toEqual(["list:faith", "tag:faith:은혜"]);
  });
});
