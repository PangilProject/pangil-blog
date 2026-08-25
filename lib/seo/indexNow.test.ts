import { describe, expect, it } from "vitest";

import { describeIndexNowStatus, INDEXNOW_KEY_PATH, planIndexNow } from "@/lib/seo/indexNow";

const KEY = "a1b2c3d4e5f6a7b8";
const HOST = "dev.pangil.me";

describe("planIndexNow", () => {
  it("키와 도메인이 있으면 제출 요청을 만든다", () => {
    const plan = planIndexNow({
      key: KEY,
      siteHost: HOST,
      urls: [`https://${HOST}/prisma-7`, `https://${HOST}/dev`],
    });

    expect(plan).toEqual({
      submit: true,
      request: {
        endpoint: "https://api.indexnow.org/indexnow",
        body: {
          host: HOST,
          key: KEY,
          keyLocation: `https://${HOST}${INDEXNOW_KEY_PATH}`,
          urlList: [`https://${HOST}/prisma-7`, `https://${HOST}/dev`],
        },
      },
    });
  });

  it("도메인이 없으면 보내지 않는다 — 임시 호스트로 색인을 만들면 301을 걸 수 없다", () => {
    expect(planIndexNow({ key: KEY, siteHost: undefined, urls: ["https://x/y"] })).toEqual({
      submit: false,
      reason: "no-domain",
    });
  });

  it("도메인 확인이 키보다 먼저다 — 도메인 미확정 구간의 키 없음은 실수가 아니다", () => {
    const plan = planIndexNow({ key: undefined, siteHost: undefined, urls: ["https://x/y"] });
    expect(plan).toEqual({ submit: false, reason: "no-domain" });
  });

  it("도메인은 있고 키가 없으면 설정 실수로 본다", () => {
    expect(planIndexNow({ key: undefined, siteHost: HOST, urls: [`https://${HOST}/a`] })).toEqual({
      submit: false,
      reason: "no-key",
    });
  });

  it("호스트가 다른 URL은 버린다 — 규격 위반은 422로만 드러난다", () => {
    const plan = planIndexNow({
      key: KEY,
      siteHost: HOST,
      urls: [`https://${HOST}/a`, "https://faith.pangil.me/sr-1", "http://insecure/a"],
    });

    expect(plan.submit && plan.request.body.urlList).toEqual([`https://${HOST}/a`]);
  });

  it("중복 URL을 합친다", () => {
    const plan = planIndexNow({
      key: KEY,
      siteHost: HOST,
      urls: [`https://${HOST}/a`, `https://${HOST}/a`],
    });

    expect(plan.submit && plan.request.body.urlList).toHaveLength(1);
  });

  it("보낼 URL이 하나도 없으면 조용히 넘어간다", () => {
    expect(planIndexNow({ key: KEY, siteHost: HOST, urls: [] })).toEqual({
      submit: false,
      reason: "no-urls",
    });
  });
});

describe("describeIndexNowStatus", () => {
  it("403은 키 파일을 가리킨다 — 이 응답만으로 원인을 알 수 있어야 한다", () => {
    expect(describeIndexNowStatus(403)).toContain("키 파일");
  });

  it("모르는 코드도 숫자를 남긴다", () => {
    expect(describeIndexNowStatus(500)).toContain("500");
  });
});

describe("키 파일 경로", () => {
  it("라우트 디렉터리와 상수가 일치한다 — 어긋나면 403으로만 드러난다", async () => {
    const { readdir } = await import("node:fs/promises");
    const entries = await readdir("app/(feeds)", { withFileTypes: true });

    expect(entries.map((entry) => entry.name)).toContain(INDEXNOW_KEY_PATH.replace("/", ""));
  });
});
