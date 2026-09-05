import { describe, expect, it } from "vitest";

import {
  isInternalPath,
  resolveSite,
  sitePrefixOf,
  siteRewritePath,
  staleSiteRedirect,
} from "@/lib/site/resolveSite";

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

describe("sitePrefixOf — 이미 사이트 세그먼트로 시작하는 경로", () => {
  /**
   * 호스트가 하나인 환경에서 `/faith/sr-1`을 또 리라이트하면 `/hub/faith/sr-1`이 되어 404다.
   * 발행 직후 이동이 실제로 그랬다 — 그래서 이 판정을 테스트로 고정한다.
   */
  it("사이트 키로 시작하면 그 키를 돌려준다", () => {
    expect(sitePrefixOf("/faith/sr-1")).toBe("faith");
    expect(sitePrefixOf("/dev")).toBe("dev");
    expect(sitePrefixOf("/hub/")).toBe("hub");
  });

  it("사이트 키가 아니면 null이다", () => {
    expect(sitePrefixOf("/")).toBeNull();
    expect(sitePrefixOf("/sr-1")).toBeNull();
    expect(sitePrefixOf("/tags/next")).toBeNull();
    // 실제 글 slug가 사이트 키처럼 생기는 일은 없다(faith·dev·hub는 예약어처럼 쓰인다)
    expect(sitePrefixOf("/development/x")).toBeNull();
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

/**
 * 지면이 경로였던 시절의 주소는 이미 밖에 나가 있다. 도메인을 붙이는 순간 전부 404가 됐고,
 * 읽는 사람 쪽에서는 고칠 길이 없다 — 제 호스트로 돌려보낸다.
 */
describe("staleSiteRedirect — 옛 주소 구제", () => {
  it("루트 호스트의 지면 경로를 그 지면 호스트로 보낸다", () => {
    expect(staleSiteRedirect("/faith/sr-1", "", HOSTS)).toBe("https://faith.pangil.example/sr-1");
    expect(staleSiteRedirect("/dev", "", HOSTS)).toBe("https://dev.pangil.example/");
  });

  it("쿼리를 잃지 않는다 — 필터와 검색어가 주소에 있다", () => {
    expect(staleSiteRedirect("/dev", "?category=fe", HOSTS)).toBe(
      "https://dev.pangil.example/?category=fe",
    );
  });

  it("허브 경로도 같은 규칙이다 — `/hub`는 라우트일 뿐 주소가 아니다", () => {
    expect(staleSiteRedirect("/hub/privacy", "", HOSTS)).toBe("https://pangil.example/privacy");
  });

  it("접두사가 남은 채 제 호스트에 온 주소도 받는다 — 실제로 이게 404였다", () => {
    expect(staleSiteRedirect("/dev/0504", "", HOSTS)).toBe("https://dev.pangil.example/0504");
  });

  it("지면 경로가 아니면 건드리지 않는다 — 그게 대부분의 요청이다", () => {
    expect(staleSiteRedirect("/sr-1", "", HOSTS)).toBeNull();
    expect(staleSiteRedirect("/", "", HOSTS)).toBeNull();
    expect(staleSiteRedirect("/tags/감사", "", HOSTS)).toBeNull();
  });

  it("도메인 미확정 구간에서는 아무것도 하지 않는다 — 거기서는 경로가 곧 지면이다", () => {
    expect(staleSiteRedirect("/faith/sr-1", "", {})).toBeNull();
  });
});
