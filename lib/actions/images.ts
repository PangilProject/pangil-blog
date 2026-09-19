"use server";

import { withAdmin } from "@/lib/actions/withAdmin";
import { createAsset } from "@/lib/db/assets";
import { toWebp } from "@/lib/images/transcode";
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

    /*
      **한도는 받은 파일로 재고, 저장은 줄인 것으로 한다.** 순서가 반대면 4MB짜리 PNG가
      "webp로 줄이면 400KB인데" 거절된다 — 한도의 이유는 Vercel 함수 본문 4.5MB이고,
      그건 이미 이 자리까지 온 시점에 통과한 것이다(lib/images/limits).
    */
    const image = await toWebp(await file.arrayBuffer(), file.type);

    const uploaded = await uploadImage({
      bytes: image.bytes,
      mimeType: image.mimeType,
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

    // 적어 두는 것은 **저장소에 있는 것**이다 — 받은 파일이 아니라(용량 집계가 여기서 나온다)
    await createAsset({
      postId,
      storagePath: uploaded.storagePath,
      mimeType: image.mimeType,
      width,
      height,
      bytes: image.bytes.byteLength,
    });

    return { ok: true, url: uploaded.url, width, height };
  },
);
