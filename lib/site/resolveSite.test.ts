import { describe, expect, it } from "vitest";

import { isInternalPath, resolveSite, siteRewritePath } from "@/lib/site/resolveSite";

const HOSTS = {
  root: "pangil.example",
  dev: "dev.pangil.example",
  faith: "faith.pangil.example",
};

describe("resolveSite — env로 주입한 3호스트", () => {
  it("루트 호스트는 허브로 간다", () => {
    expect(resolveSite({ host: "pangil.example", hosts: HOSTS })).toBe("hub");
  });

  it("dev 호스트는 기술 블로그로 간다", () => {
    expect(resolveSite({ host: "dev.pangil.example", hosts: HOSTS })).toBe("dev");
  });

  it("faith 호스트는 묵상 블로그로 간다", () => {
    expect(resolveSite({ host: "faith.pangil.example", hosts: HOSTS })).toBe("faith");
  });

  it("포트와 대문자가 붙어도 같은 호스트로 본다", () => {
    expect(resolveSite({ host: "DEV.Pangil.Example:3000", hosts: HOSTS })).toBe("dev");
  });

  it("모르는 호스트는 허브로 폴백한다", () => {
    expect(resolveSite({ host: "unknown.example", hosts: HOSTS })).toBe("hub");
  });
});

describe("resolveSite — env 미설정 폴백", () => {
  it("서브도메인 라벨로 판단한다", () => {
    expect(resolveSite({ host: "dev.somewhere.app" })).toBe("dev");
    expect(resolveSite({ host: "faith.somewhere.app" })).toBe("faith");
    expect(resolveSite({ host: "somewhere.app" })).toBe("hub");
  });

  it("서브도메인 명칭 미확정 대비로 tech.도 기술 블로그로 받는다", () => {
    expect(resolveSite({ host: "tech.somewhere.app" })).toBe("dev");
  });

  it("host가 없으면 허브로 폴백한다", () => {
    expect(resolveSite({ host: null })).toBe("hub");
  });
});

describe("resolveSite — ?site= 개발 폴백", () => {
  it("로컬호스트에서는 쿼리로 3면을 전환한다", () => {
    expect(resolveSite({ host: "localhost:3000", siteParam: "faith" })).toBe("faith");
    expect(resolveSite({ host: "localhost:3000", siteParam: "dev" })).toBe("dev");
    expect(resolveSite({ host: "localhost:3000" })).toBe("hub");
  });

  it("Vercel 기본 주소에서도 전환한다", () => {
    expect(resolveSite({ host: "pangil-blog.vercel.app", siteParam: "dev" })).toBe("dev");
  });

  it("실제 도메인에서는 ?site=를 무시한다", () => {
    expect(resolveSite({ host: "faith.pangil.example", siteParam: "dev", hosts: HOSTS })).toBe(
      "faith",
    );
  });

  it("알 수 없는 ?site= 값은 무시한다", () => {
    expect(resolveSite({ host: "localhost", siteParam: "admin" })).toBe("hub");
  });
});

describe("siteRewritePath", () => {
  it("루트 경로는 사이트 홈으로 리라이트한다", () => {
    expect(siteRewritePath("hub", "/")).toBe("/hub");
  });

  it("하위 경로는 사이트 아래로 붙인다", () => {
    expect(siteRewritePath("faith", "/tags/감사")).toBe("/faith/tags/감사");
    expect(siteRewritePath("dev", "/posts/hello")).toBe("/dev/posts/hello");
  });
});

describe("isInternalPath — 3면 리라이트 예외", () => {
  it("관리 영역은 호스트 무관 경로라 리라이트하지 않는다", () => {
    expect(isInternalPath("/admin")).toBe(true);
    expect(isInternalPath("/admin/login")).toBe(true);
  });

  it("확인 페이지도 3면에 속하지 않는다", () => {
    expect(isInternalPath("/design")).toBe(true);
  });

  it("공개 경로는 리라이트 대상이다", () => {
    expect(isInternalPath("/")).toBe(false);
    expect(isInternalPath("/tags/감사")).toBe(false);
  });

  it("접두사만 같은 경로를 내부로 오인하지 않는다", () => {
    expect(isInternalPath("/administrator")).toBe(false);
    expect(isInternalPath("/designs")).toBe(false);
  });
});
