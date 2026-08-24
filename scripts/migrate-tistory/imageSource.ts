import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { type ProbedImage, probeImage } from "@/lib/images/probe";

/**
 * 본문 이미지의 실제 바이트 확보 (05 §6.6).
 *
 * 세 갈래가 있다:
 *   `./img/img.png`         백업 폴더의 로컬 파일 — 스냅샷에 함께 들어 있다
 *   `https://velog…/x.png`  velog CDN 직링크 618개. **내려받아 옮긴다** — velog를 지우면
 *                           그 65편이 깨진다(완전 이주 원칙, §6.6 "CDN 직링크 미보존")
 *   `data:image/jpeg;base64` 본문에 박힌 이미지. 그것도 파일이다
 */

export type ImageBytes = {
  bytes: Uint8Array;
  probed: ProbedImage;
};

export type ImageFailure = {
  reason: "not-found" | "fetch-failed" | "unknown-format" | "unsupported-format" | "too-large";
  detail: string;
};

export type ImageResult = { ok: true; image: ImageBytes } | { ok: false; failure: ImageFailure };

/**
 * 이관 한도는 붙여넣기 한도(5MB, lib/storage/images)보다 크다.
 *
 * 백업에 5~12MB PNG가 5장 있는데, 이미 발행된 글의 그림을 한도 때문에 잃는 것과 앞으로
 * 붙여넣을 그림에 한도를 두는 것은 다른 판단이다. 지면 무게는 next/image가 다시 인코딩해
 * 해결하고, 여기서 커지는 것은 저장 용량뿐이다.
 *
 * **버킷의 file_size_limit도 함께 올려야 한다** — 아니면 업로드가 거부된다.
 */
const MAX_BYTES = 15 * 1024 * 1024;

const TIMEOUT_MS = 20_000;

function judge(bytes: Uint8Array, detail: string): ImageResult {
  if (bytes.byteLength > MAX_BYTES) {
    return {
      ok: false,
      failure: {
        reason: "too-large",
        detail: `${Math.round(bytes.byteLength / 1024)}KB ${detail}`,
      },
    };
  }

  const probed = probeImage(bytes);
  if (!probed) return { ok: false, failure: { reason: "unknown-format", detail } };

  // HEIC은 형식은 알지만 브라우저가 그리지 못한다 — 올려도 지면에서 깨진다
  if (probed.mime === "image/heic" || probed.width === 0) {
    return {
      ok: false,
      failure: { reason: "unsupported-format", detail: `${probed.mime} ${detail}` },
    };
  }

  return { ok: true, image: { bytes, probed } };
}

function decodeDataUri(src: string): ImageResult {
  const comma = src.indexOf(",");
  const payload = comma === -1 ? "" : src.slice(comma + 1);

  if (!src.includes(";base64") || payload === "") {
    return { ok: false, failure: { reason: "unknown-format", detail: "data URI" } };
  }

  return judge(new Uint8Array(Buffer.from(payload, "base64")), "data URI");
}

async function fetchRemote(src: string): Promise<ImageResult> {
  try {
    const response = await fetch(src, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) {
      return {
        ok: false,
        failure: { reason: "fetch-failed", detail: `${response.status} ${src}` },
      };
    }

    return judge(new Uint8Array(await response.arrayBuffer()), src);
  } catch (error) {
    return {
      ok: false,
      failure: {
        reason: "fetch-failed",
        detail: `${src} — ${error instanceof Error ? error.message : String(error)}`,
      },
    };
  }
}

async function readLocal(src: string, folder: string): Promise<ImageResult> {
  // `./img/img.png` — 글 폴더 기준 상대 경로다
  const path = join(folder, src.replace(/^\.\//, ""));

  try {
    return judge(new Uint8Array(await readFile(path)), src);
  } catch {
    return { ok: false, failure: { reason: "not-found", detail: path } };
  }
}

export function isRemoteSource(src: string): boolean {
  return /^(https?:)?\/\//.test(src);
}

export function loadImage(src: string, folder: string): Promise<ImageResult> {
  if (src.startsWith("data:")) return Promise.resolve(decodeDataUri(src));
  if (isRemoteSource(src)) return fetchRemote(src.startsWith("//") ? `https:${src}` : src);
  return readLocal(src, folder);
}
