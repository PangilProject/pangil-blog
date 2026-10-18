import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { GET } from "@/app/(feeds)/robots.txt/route";
import { BLOCKED_BOTS } from "@/lib/site/blockedBots";

/**
 * robots.txt는 **한 줄 잘못 적으면 사이트가 통째로 사라지는** 파일이다. 화면에서는 아무것도
 * 달라 보이지 않으므로 눈으로 잡을 수 없다 — 그래서 세 갈래를 여기서 고정한다.
 */
const HOSTS = {
  SITE_HOST_ROOT: "pangil.me",
  SITE_HOST_DEV: "dev.pangil.me",
  SITE_HOST_FAITH: "faith.pangil.me",
};

function read(host: string) {
  return GET(new Request(`https://${host}/robots.txt`, { headers: { host } }) as never).text();
}

const original = { ...process.env };

beforeEach(() => {
  Object.assign(process.env, HOSTS);
});

afterEach(() => {
  process.env = { ...original };
});

describe("robots.txt", () => {
  it("관리 화면과 API는 크롤하지 않는다", async () => {
    const body = await read("faith.pangil.me");

    expect(body).toContain("Disallow: /admin");
    expect(body).toContain("Disallow: /api");
    expect(body).toContain("Allow: /");
  });

  /**
   * 긁어 가는 봇은 자기 이름의 묶음에서 통째로 막힌다. 반대로 **검색엔진은 그 묶음에 들어가면
   * 안 된다** — 실수로 하나 섞이면 그 검색에서 사이트가 사라지고, 화면에서는 아무것도 안 보인다.
   */
  it("긁어 가는 봇은 통째로 막고, 검색엔진과 링크 미리보기는 건드리지 않는다", async () => {
    const body = await read("dev.pangil.me");

    for (const bot of BLOCKED_BOTS) {
      expect(body).toContain(`User-agent: ${bot}\nDisallow: /\n`);
    }
    for (const kept of ["Googlebot", "bingbot", "Applebot", "Yeti", "facebookexternalhit"]) {
      expect(body).not.toContain(kept);
    }
    // 나머지 모두의 규칙은 그대로다
    expect(body).toContain("User-agent: *\nAllow: /");
  });

  it("지면마다 자기 sitemap을 가리킨다 — 검색엔진은 호스트 단위로 읽는다", async () => {
    expect(await read("faith.pangil.me")).toContain("Sitemap: https://faith.pangil.me/sitemap.xml");
    expect(await read("dev.pangil.me")).toContain("Sitemap: https://dev.pangil.me/sitemap.xml");
  });

  /**
   * 최종 도메인이 붙는 날 같은 글이 두 주소로 걸리면, 새 도메인이 중복으로 취급받는 쪽에서
   * 시작한다. 출시 전 주소는 색인되지 않아야 한다(07 §4).
   */
  it("최종 도메인이 아닌 곳은 통째로 막는다", async () => {
    const body = await read("pangil-blog.vercel.app");

    expect(body).toContain("Disallow: /");
    expect(body).not.toContain("Allow: /");
    // 막힌 곳의 sitemap을 굳이 알려주지 않는다
    expect(body).not.toContain("Sitemap:");
  });

  it("로컬도 마찬가지다", async () => {
    expect(await read("localhost:3000")).toContain("Disallow: /");
  });
});
