/**
 * 이미지 바이트에서 형식과 크기를 읽는다 (05 §6.6 "원본 폭·높이 기록").
 *
 * 이관은 서버에서 돈다 — 브라우저가 크기를 재주는 붙여넣기 경로(04 §3.3)를 쓸 수 없다.
 * 그래서 헤더만 직접 읽는다. 디코더를 들이지 않는 이유는 우리가 필요한 것이 픽셀이 아니라
 * **숫자 두 개**이기 때문이다(next/image가 그걸 요구한다).
 *
 * 확장자를 믿지 않고 바이트를 본다. 백업에는 `.dat`이나 확장자 없는 파일이 섞여 있고,
 * 그것들도 실은 PNG였다.
 */

export type ProbedImage = {
  /** Storage에 올릴 때 쓰는 content-type */
  mime: string;
  extension: string;
  width: number;
  height: number;
};

function isPng(bytes: Uint8Array): boolean {
  return (
    bytes.length > 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  );
}

function isGif(bytes: Uint8Array): boolean {
  return bytes.length > 10 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46;
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8;
}

function isWebp(bytes: Uint8Array): boolean {
  return (
    bytes.length > 30 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  );
}

/** HEIC/HEIF — 브라우저가 그리지 못하므로 크기를 재지 않고 형식만 알린다 */
function isHeic(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  const brand = String.fromCharCode(...bytes.slice(4, 12));
  return brand.startsWith("ftyp") && /heic|heix|hevc|mif1|msf1/.test(brand.slice(4));
}

function pngSize(view: DataView) {
  // IHDR은 항상 첫 청크다
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function gifSize(view: DataView) {
  return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
}

function webpSize(bytes: Uint8Array, view: DataView) {
  const format = String.fromCharCode(...bytes.slice(12, 16));

  // VP8 / VP8L / VP8X — 세 가지 인코딩이 크기를 다른 자리에 적는다
  if (format === "VP8 ") {
    return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
  }

  if (format === "VP8L") {
    const bits = view.getUint32(21, true);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }

  if (format === "VP8X") {
    const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
    const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
    return { width, height };
  }

  return null;
}

/** SOF 마커를 찾을 때까지 세그먼트를 건너뛴다 */
function jpegSize(bytes: Uint8Array, view: DataView) {
  let offset = 2;

  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1];
    // SOF0~SOF15 (DHT·DAC·RST 제외)
    const isSof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);

    if (isSof) {
      return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) };
    }

    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }

    offset += 2 + view.getUint16(offset + 2);
  }

  return null;
}

export function probeImage(bytes: Uint8Array): ProbedImage | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (isPng(bytes)) return { mime: "image/png", extension: "png", ...pngSize(view) };
  if (isGif(bytes)) return { mime: "image/gif", extension: "gif", ...gifSize(view) };

  if (isJpeg(bytes)) {
    const size = jpegSize(bytes, view);
    return size ? { mime: "image/jpeg", extension: "jpg", ...size } : null;
  }

  if (isWebp(bytes)) {
    const size = webpSize(bytes, view);
    return size ? { mime: "image/webp", extension: "webp", ...size } : null;
  }

  // 형식은 알지만 우리가 올릴 수 없는 것 — 호출자가 이유를 알아야 한다
  if (isHeic(bytes)) return { mime: "image/heic", extension: "heic", width: 0, height: 0 };

  return null;
}
