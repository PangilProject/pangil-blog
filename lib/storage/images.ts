import "server-only";

import { nanoid } from "nanoid";

import { MAX_IMAGE_BYTES } from "@/lib/images/limits";

/**
 * 이미지 업로드 (04 §3.3 · 05 §1.4 Asset).
 *
 * **supabase-js를 쓰지 않는다.** 이 프로젝트는 데이터 접근을 Prisma로 통일했고(AGENTS.md),
 * Storage에 필요한 건 REST 호출 하나뿐이다 — 그걸 위해 클라이언트 라이브러리를 들일 이유가 없다.
 *
 * 쓰기는 service role로만 한다(서버 전용). 읽기는 버킷이 public-read다 — 서명 URL은 만료되므로
 * 캐시된 HTML·RSS·검색엔진에서 이미지가 어느 시점에 깨진다. 발행된 글의 이미지는 어차피
 * 공개될 것이니 읽기를 여는 편이 정확하다.
 */

const BUCKET = "post-images";

/**
 * 한 번 올린 파일은 다시 바뀌지 않는다 — 이름이 `nanoid`라 내용이 달라지면 이름도 달라진다.
 * 그러니 영구히 캐시해도 안전하고, 그게 **안전할 뿐 아니라 필요하다.**
 *
 * Supabase Storage의 기본값은 `no-cache`다. 그 값이면 CDN도 브라우저도 아무것도 쥐고 있지
 * 않아 **글을 열 때마다 원본이 다시 나간다.** Vercel 최적화기가 앞에서 받아 주는 동안에는
 * 가려져 있었는데, 그걸 끄자(`next.config.ts`) 하루 만에 Egress가 5GB 한도를 넘었다.
 */
const IMMUTABLE = "public, max-age=31536000, immutable";

/** 05 §1.4의 경로 규칙: `post-images/{postId|orphan}/{nanoid}.{ext}` */
const ORPHAN_PREFIX = "orphan";

// 한도는 화면도 봐야 하는 값이라 순수 모듈에 있다(lib/images/limits)
export { MAX_IMAGE_BYTES };

export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

export type UploadImageInput = {
  bytes: ArrayBuffer;
  mimeType: string;
  /** 아직 저장 전인 새 글이면 null — 그때는 orphan 폴더로 간다(05 §1.4 주석) */
  postId: string | null;
};

export type UploadImageResult =
  | { ok: true; storagePath: string; url: string }
  | { ok: false; reason: "unsupported-type" | "too-large" | "upload-failed"; detail?: string };

function storageEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다 (.env.example 참조).",
    );
  }

  return { url, key };
}

/** 공개 읽기 주소. 버킷이 public-read이므로 서명이 없다 */
export function publicImageUrl(storagePath: string, baseUrl?: string): string {
  const url = baseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${url}/storage/v1/object/public/${storagePath}`;
}

export async function uploadImage({
  bytes,
  mimeType,
  postId,
}: UploadImageInput): Promise<UploadImageResult> {
  const extension = ALLOWED_IMAGE_TYPES[mimeType];
  if (!extension) return { ok: false, reason: "unsupported-type", detail: mimeType };
  if (bytes.byteLength > MAX_IMAGE_BYTES) return { ok: false, reason: "too-large" };

  const { url, key } = storageEnv();
  const storagePath = `${BUCKET}/${postId ?? ORPHAN_PREFIX}/${nanoid()}.${extension}`;

  const response = await fetch(`${url}/storage/v1/object/${storagePath}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": mimeType,
      "cache-control": IMMUTABLE,
      // 같은 경로가 겹칠 일은 없지만(nanoid), 덮어쓰기를 허용하지 않는 편이 사고를 줄인다
      "x-upsert": "false",
    },
    body: bytes,
  });

  if (!response.ok) {
    return {
      ok: false,
      reason: "upload-failed",
      detail: `${response.status} ${(await response.text()).slice(0, 200)}`,
    };
  }

  return { ok: true, storagePath, url: publicImageUrl(storagePath, url) };
}
