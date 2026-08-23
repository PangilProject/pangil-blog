import { describe, expect, it } from "vitest";

import { isOptimizableImage } from "@/lib/render/imageHost";

const SUPABASE = "https://project.supabase.co";

/**
 * 기준이 호스트여야 하는 이유가 이 테스트의 전부다. 티스토리 이미지는 width/height를 갖고
 * 들어오므로, 크기로 판단하면 외부 호스트가 next/image로 넘어가 지면이 터진다.
 */
describe("isOptimizableImage", () => {
  it("우리 Storage 이미지는 최적화한다", () => {
    expect(
      isOptimizableImage(`${SUPABASE}/storage/v1/object/public/post-images/a/b.png`, SUPABASE),
    ).toBe(true);
  });

  it("상대 경로는 우리 지면의 것이다", () => {
    expect(isOptimizableImage("/og/sample.png", SUPABASE)).toBe(true);
  });

  it("외부 호스트는 최적화하지 않는다 — 크기를 알든 모르든", () => {
    expect(isOptimizableImage("https://blog.kakaocdn.net/dna/x/img.png", SUPABASE)).toBe(false);
    expect(isOptimizableImage("https://i.ytimg.com/vi/x/hqdefault.jpg", SUPABASE)).toBe(false);
  });

  it("주소가 아니거나 설정이 없으면 최적화하지 않는다", () => {
    expect(isOptimizableImage("그냥 글자", SUPABASE)).toBe(false);
    expect(isOptimizableImage(`${SUPABASE}/x.png`, undefined)).toBe(false);
  });
});
