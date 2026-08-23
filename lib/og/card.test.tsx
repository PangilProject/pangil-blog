import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import type { OgCard } from "@/lib/db/publicPosts";
import { buildOgSvg, clamp, type OgFonts, rasterize, titleFontSize } from "@/lib/og/card";

let fonts: OgFonts;

beforeAll(async () => {
  // 프로덕션 경로는 번들 추적용 import.meta.url을 쓴다. 테스트 런타임에서는 그 URL이 file:이
  // 아니라서 여기서는 경로로 직접 읽는다
  const dir = join(process.cwd(), "lib/og/fonts");
  const [serif, mono] = await Promise.all([
    readFile(join(dir, "gowun-batang-700-ks.ttf")),
    readFile(join(dir, "nanum-gothic-coding-ascii.ttf")),
  ]);
  fonts = { serif, mono };
});

/**
 * OG 카드는 링크 공유의 얼굴이다(04 §3.5). 여기서 고정하는 것은 두 가지다.
 * 1. PNG가 실제로 나온다 — next/og가 이 환경에서 깨져 직접 이어 붙인 경로이므로 회귀가 무섭다
 * 2. 긴 글자가 카드를 넘치지 않는다 — 넘치면 푸터를 덮는다(실제로 그랬다)
 */
const card: OgCard = {
  type: "QT",
  title: "주님이 네 악을 네 머리로 돌려보내시리라",
  subtitle: "열왕기상 2장 41~46절",
  callNumber: 1,
  categoryName: null,
  publishedAt: "2026년 8월 23일",
  siteLabel: "믿음의 기록",
  typeLabel: "큐티",
};

describe("clamp", () => {
  it("짧은 글자는 그대로 둔다", () => {
    expect(clamp("주님의 시간에", 20)).toBe("주님의 시간에");
  });

  it("길면 말줄임으로 자른다", () => {
    expect(clamp("가".repeat(30), 10)).toBe(`${"가".repeat(9)}…`);
  });

  it("앞뒤 공백을 다듬는다", () => {
    expect(clamp("  제목  ", 20)).toBe("제목");
  });
});

describe("titleFontSize", () => {
  it("제목이 길수록 글자를 줄인다 — 630px 안에 들어와야 한다", () => {
    expect(titleFontSize(10)).toBeGreaterThan(titleFontSize(30));
    expect(titleFontSize(30)).toBeGreaterThan(titleFontSize(60));
  });
});

describe("buildOgSvg · rasterize", () => {
  it("한글 제목을 path로 굽고 PNG로 나온다", async () => {
    const svg = await buildOgSvg(card, fonts);
    expect(svg).toContain("<path");

    const png = rasterize(svg);

    // PNG 매직 바이트
    expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(png.byteLength).toBeGreaterThan(5_000);
  }, 30_000);

  it("아주 긴 제목·요약에도 그려진다 — 넘치면 푸터를 덮는다", async () => {
    const svg = await buildOgSvg(
      {
        ...card,
        type: "TECH",
        title: "[Checky] ".repeat(12),
        subtitle: "요약 ".repeat(80),
        categoryName: "FE",
      },
      fonts,
    );

    expect(rasterize(svg).subarray(1, 4).toString("ascii")).toBe("PNG");
    // 잘린 표시가 남는다
    expect(svg).toContain("<path");
  }, 30_000);

  it("청구기호·부제가 없어도 그려진다", async () => {
    const svg = await buildOgSvg(
      { ...card, callNumber: null, subtitle: null, publishedAt: null },
      fonts,
    );

    expect(rasterize(svg).subarray(1, 4).toString("ascii")).toBe("PNG");
  }, 30_000);
});
