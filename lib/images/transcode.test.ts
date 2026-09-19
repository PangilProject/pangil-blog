import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { toWebp } from "@/lib/images/transcode";

/**
 * 업로드가 저장소를 먹던 문제를 고정한다 — PNG 1753장이 이미지 688MB의 94%였다.
 *
 * 여기서 지키는 불변식은 둘이다: **줄어들 때만 바꾼다**, 그리고 **바꾸다 실패해도 글쓰기를
 * 막지 않는다**. 뒤엣것이 더 중요하다 — 저장소를 아끼려다 글을 못 올리게 되면 거래가
 * 성립하지 않는다(프리모템 #2).
 */

/** 사진을 흉내 낸다 — 색이 이어져 흐르므로 PNG로 담으면 크고 webp면 작다 */
async function photoPng(width = 400, height = 300): Promise<ArrayBuffer> {
  const pixels = Buffer.alloc(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    const x = i % width;
    const y = Math.floor(i / width);
    pixels[i * 3] = (x * 255) / width;
    pixels[i * 3 + 1] = (y * 255) / height;
    pixels[i * 3 + 2] = ((x + y) * 255) / (width + height);
  }
  const png = await sharp(pixels, { raw: { width, height, channels: 3 } })
    .png()
    .toBuffer();
  return png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) as ArrayBuffer;
}

describe("toWebp", () => {
  it("PNG 사진을 webp로 줄인다", async () => {
    const png = await photoPng();

    const result = await toWebp(png, "image/png");

    expect(result.converted).toBe(true);
    expect(result.mimeType).toBe("image/webp");
    expect(result.bytes.byteLength).toBeLessThan(png.byteLength);
  });

  it("줄인 바이트가 정말 webp다 — 받는 쪽이 읽을 수 있어야 한다", async () => {
    const result = await toWebp(await photoPng(), "image/png");

    const meta = await sharp(Buffer.from(result.bytes)).metadata();
    expect(meta.format).toBe("webp");
    // 크기는 건드리지 않는다. 지면에 낼 때 줄이는 일은 next/image가 한다
    expect(meta.width).toBe(400);
    expect(meta.height).toBe(300);
  });

  /**
   * GIF를 한 장으로 눌러버리면 **움직임이 사라진다.** 손실이 아니라 소실이다.
   */
  it("GIF는 손대지 않는다 — 움직이는 그림이다", async () => {
    const gif = await photoPng(20, 20);

    const result = await toWebp(gif, "image/gif");

    expect(result.converted).toBe(false);
    expect(result.mimeType).toBe("image/gif");
    expect(result.bytes).toBe(gif);
  });

  it("이미 webp·avif면 다시 누르지 않는다 — 손실만 겹친다", async () => {
    for (const mime of ["image/webp", "image/avif"]) {
      const result = await toWebp(await photoPng(20, 20), mime);

      expect(result.converted).toBe(false);
      expect(result.mimeType).toBe(mime);
    }
  });

  /**
   * **줄지 않으면 바꾸지 않는다.**
   *
   * 실전에서 이 자리를 밟는 것은 mime이 잘못 붙어 온 파일이다. 확장자와 실제 형식이 어긋난
   * 파일은 실제로 있었고(`lib/images/probe` 주석 — 백업에 `.dat`인 PNG가 섞여 있었다),
   * 이미 눌린 webp를 `image/png`이라고 받으면 **다시 누르느라 커진다.**
   *
   * 평범한 PNG로는 이 가지를 재현할 수 없다 — 재보면 webp가 늘 이긴다. 그래서 여기서
   * 고정하는 것은 "PNG가 이길 때가 있다"가 아니라 **커지면 되돌린다는 규칙 자체**다.
   */
  it("바꿔서 커지면 원본을 쓴다 — mime이 잘못 붙어 온 파일이 그렇다", async () => {
    const pressed = await sharp(Buffer.from(await photoPng(200, 150)))
      .webp({ quality: 90, effort: 6 })
      .toBuffer();
    const bytes = pressed.buffer.slice(
      pressed.byteOffset,
      pressed.byteOffset + pressed.byteLength,
    ) as ArrayBuffer;

    const result = await toWebp(bytes, "image/png");

    expect(result.converted).toBe(false);
    expect(result.bytes).toBe(bytes);
  });

  /**
   * **이것이 이 파일에서 가장 중요한 테스트다.** 변환은 최적화이지 필수가 아니다 —
   * 못 바꿨다고 업로드를 실패시키면 저장소를 아끼려다 글쓰기를 막는다.
   */
  it("이미지가 아닌 바이트를 받아도 던지지 않고 원본을 돌려준다", async () => {
    const garbage = new TextEncoder().encode("이건 그림이 아니다").buffer as ArrayBuffer;

    const result = await toWebp(garbage, "image/png");

    expect(result.converted).toBe(false);
    expect(result.mimeType).toBe("image/png");
    expect(result.bytes).toBe(garbage);
  });

  it("빈 바이트에도 던지지 않는다", async () => {
    const empty = new ArrayBuffer(0);

    await expect(toWebp(empty, "image/png")).resolves.toMatchObject({ converted: false });
  });
});
