import { describe, expect, it } from "vitest";

import { postRevalidationTags, siteOf } from "@/lib/revalidate/tags";

describe("siteOf — 05 §1.4 파생 규칙", () => {
  it("TECH만 dev이고 묵상 3타입은 faith다", () => {
    expect(siteOf("TECH")).toBe("dev");
    expect(siteOf("QT")).toBe("faith");
    expect(siteOf("SERMON")).toBe("faith");
    expect(siteOf("PRAISE")).toBe("faith");
  });
});

describe("postRevalidationTags — 04 §1.2", () => {
  it("QT 발행은 faith 목록·타입 필터·피드·상세를 무효화한다", () => {
    const tags = postRevalidationTags({ id: "abc", type: "QT" });

    expect(tags).toContain("post:abc");
    expect(tags).toContain("list:faith");
    expect(tags).toContain("list:faith:QT");
    expect(tags).toContain("feed:faith");
  });

  it("TECH는 카테고리 목록을 facet으로 쓴다", () => {
    const tags = postRevalidationTags({ id: "x", type: "TECH", categorySlug: "retrospective" });

    expect(tags).toContain("list:dev");
    expect(tags).toContain("list:dev:retrospective");
    expect(tags).not.toContain("list:faith");
  });

  it("카테고리가 없는 TECH도 목록 태그를 남긴다", () => {
    expect(postRevalidationTags({ id: "x", type: "TECH" })).toContain("list:dev:uncategorized");
  });

  it("태그는 site 스코프다 — 동명 태그가 다른 사이트 캐시를 날리면 안 된다", () => {
    const faith = postRevalidationTags({ id: "a", type: "QT", tagNames: ["감사"] });
    const dev = postRevalidationTags({ id: "b", type: "TECH", tagNames: ["감사"] });

    expect(faith).toContain("tag:faith:감사");
    expect(dev).toContain("tag:dev:감사");
    expect(faith).not.toContain("tag:dev:감사");
  });

  it("같은 태그를 두 번 넣지 않는다", () => {
    const tags = postRevalidationTags({ id: "a", type: "QT", tagNames: ["감사", "감사"] });
    expect(tags.length).toBe(new Set(tags).size);
  });
});
