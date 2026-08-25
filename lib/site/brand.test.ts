import { describe, expect, it } from "vitest";

import { blogBrandName, brandLabel, siteBrand } from "@/lib/site/brand";

describe("brandLabel", () => {
  it("뒷글자를 떼어 준다 — 헤더가 거기에만 액센트를 준다", () => {
    expect(brandLabel("faith")).toEqual({ lead: "믿음의 ", accent: "기록" });
    expect(blogBrandName("dev")).toBe("개발의 기록");
  });
});

describe("siteBrand", () => {
  it("허브 이름은 프로필 env에서 온다", () => {
    expect(siteBrand("hub", { NEXT_PUBLIC_PROFILE_NAME: "김광일" })).toEqual({
      name: "김광일",
      description: null,
    });
  });

  it("프로필이 비면 중립적인 이름으로 떨어진다 — 표시명은 출시 게이트다(07 §4)", () => {
    expect(siteBrand("hub", {}).name).toBe("기록");
  });

  it("여러 줄 소개를 한 줄로 편다 — meta description에 줄바꿈을 넣을 수 없다", () => {
    expect(siteBrand("hub", { NEXT_PUBLIC_PROFILE_TAGLINE: "개발자.\n\n매일 한 장씩." })).toEqual({
      name: "기록",
      description: "개발자. 매일 한 장씩.",
    });
  });
});
