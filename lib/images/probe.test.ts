import { describe, expect, it } from "vitest";

import { isUploadable, probeImage } from "@/lib/images/probe";

/**
 * 확장자를 믿지 않고 바이트를 본다 — 백업에 `.dat`이나 확장자 없는 파일이 섞여 있고,
 * 그것들도 실은 PNG였다. 헤더를 직접 읽으므로 형식마다 자리를 고정한다.
 */

/** 최소한의 PNG: 시그니처 + IHDR(폭·높이) */
function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(32);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

function gif(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(16);
  bytes.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
  const view = new DataView(bytes.buffer);
  view.setUint16(6, width, true);
  view.setUint16(8, height, true);
  return bytes;
}

/** SOI + APP0 세그먼트 하나 + SOF0 */
function jpeg(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(40);
  const view = new DataView(bytes.buffer);

  bytes.set([0xff, 0xd8], 0);
  bytes.set([0xff, 0xe0], 2);
  view.setUint16(4, 10); // APP0 길이
  bytes.set([0xff, 0xc0], 14); // SOF0
  view.setUint16(16, 11);
  view.setUint16(19, height);
  view.setUint16(21, width);

  return bytes;
}

function heic(): Uint8Array {
  const bytes = new Uint8Array(16);
  bytes.set([...Buffer.from("....ftypheic", "latin1")]);
  return bytes;
}

describe("probeImage", () => {
  it("PNG의 IHDR에서 크기를 읽는다", () => {
    expect(probeImage(png(1200, 630))).toEqual({
      mime: "image/png",
      extension: "png",
      width: 1200,
      height: 630,
    });
  });

  it("GIF는 리틀엔디언이다", () => {
    expect(probeImage(gif(320, 240))).toMatchObject({ mime: "image/gif", width: 320, height: 240 });
  });

  it("JPEG는 세그먼트를 건너뛰며 SOF를 찾는다", () => {
    expect(probeImage(jpeg(800, 600))).toMatchObject({
      mime: "image/jpeg",
      extension: "jpg",
      width: 800,
      height: 600,
    });
  });

  it("HEIC은 형식만 알린다 — 브라우저가 그리지 못한다", () => {
    expect(probeImage(heic())).toMatchObject({ mime: "image/heic", width: 0 });
  });

  it("이미지가 아니면 null이다", () => {
    expect(probeImage(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBeNull();
    expect(probeImage(new Uint8Array(0))).toBeNull();
  });
});

describe("isUploadable", () => {
  it("버킷이 받는 형식만 통과한다", () => {
    expect(isUploadable("image/png")).toBe(true);
    expect(isUploadable("image/heic")).toBe(false);
  });
});
