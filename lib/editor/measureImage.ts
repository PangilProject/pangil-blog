/**
 * 브라우저에서 이미지 크기를 잰다 (04 §3.3 — next/image가 원본 크기를 요구한다).
 *
 * 파일을 이미 들고 있는 쪽이 재는 게 정확하고 짧다. 서버에서 PNG/JPEG/WebP 헤더를 각각
 * 파싱하는 코드를 두는 것보다 이 편이 낫다 — 값이 이상하면 서버가 버린다(범위 검증).
 *
 * 실패는 null이다. 크기를 몰라도 이미지는 올라가야 한다 — 그때는 next/image 대신 원본 비율로
 * 그린다(렌더러의 폴백).
 */
export async function measureImage(file: File): Promise<{ width: number; height: number } | null> {
  if (typeof createImageBitmap !== "function") return null;

  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return null;
  }
}
