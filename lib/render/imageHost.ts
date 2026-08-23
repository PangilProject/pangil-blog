/**
 * 이 이미지를 next/image로 최적화해도 되는가 (04 §3.3).
 *
 * 기준은 **호스트**다. 크기를 안다고 우리 이미지인 것은 아니다 — 티스토리에서 HTML로 붙여넣은
 * 이미지는 `width`/`height` 속성까지 함께 들어오고, 그걸 크기 기준으로 판단하면 외부 호스트가
 * next/image로 넘어가 "hostname is not configured"로 지면이 터진다(실제로 그랬다).
 *
 * 우리 Storage와 같은 출처의 상대 경로만 최적화한다. 외부 이미지는 원본 그대로 그린다 —
 * 그게 정상이다(마이그레이션 이미지까지 끌어들이면 허용 호스트 목록을 계속 늘려야 한다).
 */
export function isOptimizableImage(
  src: string,
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
) {
  // 상대 경로는 우리 지면의 것이다
  if (src.startsWith("/")) return true;
  if (!supabaseUrl) return false;

  try {
    return new URL(src).host === new URL(supabaseUrl).host;
  } catch {
    return false;
  }
}
