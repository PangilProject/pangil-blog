import "server-only";

import sharp from "sharp";

/**
 * 올리기 전에 webp로 줄인다 (04 §3.3).
 *
 * PNG가 저장소를 먹고 있었다. 실측: PNG 1753장 646.9MB가 전체 이미지 688MB의 **94%**였고,
 * 무작위 40장을 q=90 webp로 바꿔 재보니 **83% 줄었다**(13.0MB → 2.2MB). 사진과 그림을
 * 무손실로 담는 PNG의 성질 탓이지 누가 실수한 게 아니다 — 형식이 용도와 안 맞았다.
 *
 * **크기는 건드리지 않는다.** 긴 변을 2000px로 자르면 3%가 더 줄지만, 그건 원본 해상도를
 * 버리는 값이라 수지가 안 맞는다. 지면에 낼 때 줄이는 일은 next/image가 이미 한다.
 */

/** 사진·그림에서 눈에 안 보이는 선. 이 값으로 바꾼 것과 원본을 나란히 놓고 못 골랐다 */
const QUALITY = 90;

/**
 * 손대지 않는 형식.
 *
 * - `gif`: 움직이는 그림이다. 한 장으로 눌러버리면 **움직임이 사라진다**
 * - `webp`·`avif`: 이미 줄어 있다. 다시 누르면 손실만 겹친다
 */
const KEEP_AS_IS = new Set(["image/gif", "image/webp", "image/avif"]);

export type Transcoded = {
  bytes: ArrayBuffer;
  mimeType: string;
  /** 원본 그대로 두었는가 — 부르는 쪽이 로그에 남긴다 */
  converted: boolean;
};

/**
 * webp로 바꾼다. **바꾸지 못하면 원본을 그대로 돌려준다.**
 *
 * 줄이는 것은 좋은 일이지 필수가 아니다 — 변환이 실패했다고 업로드를 실패시키면, 저장소를
 * 아끼려다 **글쓰기를 막는다.** 그 거래는 성립하지 않는다(프리모템 #2).
 *
 * 커진 경우에도 원본을 쓴다. 이미 작은 그림이나 색 수가 적은 그림은 PNG가 더 작다.
 */
export async function toWebp(bytes: ArrayBuffer, mimeType: string): Promise<Transcoded> {
  const original: Transcoded = { bytes, mimeType, converted: false };

  if (KEEP_AS_IS.has(mimeType)) return original;

  try {
    const webp = await sharp(Buffer.from(bytes)).webp({ quality: QUALITY, effort: 6 }).toBuffer();

    if (webp.byteLength >= bytes.byteLength) return original;

    return {
      // Buffer의 바닥 ArrayBuffer는 남의 바이트까지 물고 있을 수 있다 — 이 구간만 떼어 낸다
      bytes: webp.buffer.slice(webp.byteOffset, webp.byteOffset + webp.byteLength) as ArrayBuffer,
      mimeType: "image/webp",
      converted: true,
    };
  } catch {
    return original;
  }
}
