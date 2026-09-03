import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { GET } from "@/app/manifest.webmanifest/route";

/**
 * 이 테스트의 이유는 **기기에서만 드러나는 고장**이다(04 §1.3 · 08 §3).
 *
 * scope를 start_url의 경로로 좁히면 화면·빌드·CI 모두 정상인데, 홈 화면에 담은 뒤 다른 면으로
 * 이동하는 순간 iOS가 브라우저 UI를 띄운다. 실제로 그랬다 — 그리고 그건 브라우저 개발자
 * 도구로도 보이지 않는다.
 */
const HOSTS = {
  SITE_HOST_ROOT: "pangil.me",
  SITE_HOST_DEV: "dev.pangil.me",
  SITE_HOST_FAITH: "faith.pangil.me",
};

function read(host: string, search = "") {
  return GET(new Request(`https://${host}/manifest.webmanifest${search}`, { headers: { host } }));
}

const original = { ...process.env };

beforeEach(() => {
  for (const key of Object.keys(HOSTS)) delete process.env[key as keyof typeof HOSTS];
});

afterEach(() => {
  process.env = { ...original };
});

describe("매니페스트", () => {
  it("호스트가 하나면 scope가 그 호스트 전체다 — 세 면이 한 앱에 있다", async () => {
    const manifest = await (await read("pangil-blog.vercel.app", "?site=hub")).json();

    expect(manifest.scope).toBe("https://pangil-blog.vercel.app/");
    // 담은 사람은 자기가 보던 면에서 열려야 한다
    expect(manifest.start_url).toBe("https://pangil-blog.vercel.app/hub");
  });

  it("도메인이 붙으면 scope가 그 지면 호스트다 — 면별로 갈린다", async () => {
    Object.assign(process.env, HOSTS);
    const manifest = await (await read("dev.pangil.me")).json();

    expect(manifest.scope).toBe("https://dev.pangil.me/");
    expect(manifest.start_url).toBe("https://dev.pangil.me/");
  });

  it("지면 안의 이동은 scope 안에 있다 — 목록·상세·태그 전부", async () => {
    const manifest = await (await read("pangil-blog.vercel.app", "?site=dev")).json();

    for (const path of ["/dev", "/dev/some-post", "/dev/tags/fe", "/faith", "/hub"]) {
      expect(`https://pangil-blog.vercel.app${path}`.startsWith(manifest.scope)).toBe(true);
    }
  });

  it("standalone이다 — iOS의 minimal-ui는 브라우저 컨트롤을 보여달라는 뜻이다", async () => {
    const manifest = await (await read("pangil-blog.vercel.app")).json();

    expect(manifest.display).toBe("standalone");
  });

  it("면마다 이름과 아이콘이 다르다", async () => {
    const dev = await (await read("pangil-blog.vercel.app", "?site=dev")).json();
    const faith = await (await read("pangil-blog.vercel.app", "?site=faith")).json();

    expect(dev.name).not.toBe(faith.name);
    expect(dev.icons[0].src).toContain("dev-");
    expect(faith.icons[0].src).toContain("faith-");
  });
});
