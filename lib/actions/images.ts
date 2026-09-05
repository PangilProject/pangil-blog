"use server";

import { withAdmin } from "@/lib/actions/withAdmin";
import { createAsset } from "@/lib/db/assets";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, uploadImage } from "@/lib/storage/images";

/**
 * 에디터 이미지 업로드 (04 §3.3).
 *
 * 붙여넣기·드롭 → 이 액션 → Storage → assets 행. 관리자만 통과한다(withAdmin) — 업로드는
 * 상태를 바꾸는 일이고, Server Action은 별도 POST로 직접 호출될 수 있다(05 §3.2).
 */

export type UploadImageFailure = "no-file" | "unsupported-type" | "too-large" | "upload-failed";

export type UploadImageActionResult =
  | { ok: true; url: string; width: number | null; height: number | null }
  | { ok: false; reason: UploadImageFailure };

/** 브라우저가 잰 크기. 값이 이상하면 없는 것으로 본다 — 잘못된 크기는 레이아웃만 흔든다 */
function sanitizeDimension(value: FormDataEntryValue | null): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 20_000 ? parsed : null;
}

export const uploadPostImage = withAdmin(
  async (_user, form: FormData): Promise<UploadImageActionResult> => {
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, reason: "no-file" };

    if (!ALLOWED_IMAGE_TYPES[file.type]) return { ok: false, reason: "unsupported-type" };
    if (file.size > MAX_IMAGE_BYTES) return { ok: false, reason: "too-large" };

    const postId = typeof form.get("postId") === "string" ? String(form.get("postId")) : null;

    const uploaded = await uploadImage({
      bytes: await file.arrayBuffer(),
      mimeType: file.type,
      postId,
    });

    if (!uploaded.ok) {
      // 실패 사유를 서버 로그에 남긴다 — 화면에는 "올리지 못했어요"까지만 간다
      console.error("[upload] 이미지 업로드 실패:", uploaded.reason, uploaded.detail);
      return {
        ok: false,
        reason: uploaded.reason === "upload-failed" ? "upload-failed" : uploaded.reason,
      };
    }

    const width = sanitizeDimension(form.get("width"));
    const height = sanitizeDimension(form.get("height"));

    await createAsset({
      postId,
      storagePath: uploaded.storagePath,
      mimeType: file.type,
      width,
      height,
      bytes: file.size,
    });

    return { ok: true, url: uploaded.url, width, height };
  },
);
