import { afterEach, describe, expect, it, vi } from "vitest";

import { articleJsonLd, blogJsonLd, personJsonLd } from "@/lib/seo/jsonLd";

/**
 * 구조화 데이터는 사람이 읽지 않는다 — 틀려도 지면에서는 보이지 않는다. 그래서 두 가지를
 * 고정한다: 프로필이 비면 사람을 지어내지 않는다, 그리고 주소는 지면 규칙을 따른다.
 */
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("author", () => {
  it("프로필 이름이 없으면 author를 적지 않는다", () => {
    vi.stubEnv("NEXT_PUBLIC_PROFILE_NAME", "");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.com");

    expect(blogJsonLd("dev", "/dev")).not.toHaveProperty("author");
    expect(personJsonLd()).toBeNull();
  });
});

describe("blogJsonLd", () => {
  it("도메인이 붙으면 지면 호스트가 주소가 되고 세그먼트가 사라진다", () => {
    vi.stubEnv("SITE_HOST_DEV", "dev.example.com");

    expect(blogJsonLd("dev", "/dev")).toMatchObject({
      "@type": "Blog",
      url: "https://dev.example.com/",
    });
  });

  it("도메인이 없으면 경로에 지면이 남는다", () => {
    vi.stubEnv("SITE_HOST_DEV", "");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.com");

    expect(blogJsonLd("dev", "/dev")).toMatchObject({ url: "https://example.com/dev" });
  });
});

describe("articleJsonLd", () => {
  it("발행일이 없어도(초안 소급 등) 수정일은 적는다", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.com");
    vi.stubEnv("SITE_HOST_FAITH", "");

    const jsonLd = articleJsonLd({
      site: "faith",
      title: "제목",
      description: null,
      path: "/faith/qt-1",
      publishedAt: null,
      updatedAt: new Date("2026-08-25T00:00:00.000Z"),
      imagePath: "/api/og/abc",
      tags: [],
    });

    expect(jsonLd).not.toHaveProperty("datePublished");
    expect(jsonLd).not.toHaveProperty("description");
    expect(jsonLd).not.toHaveProperty("keywords");
    expect(jsonLd).toMatchObject({
      "@type": "BlogPosting",
      url: "https://example.com/faith/qt-1",
      image: "https://example.com/api/og/abc",
      dateModified: "2026-08-25T00:00:00.000Z",
    });
  });
});
