import Image from "next/image";

/**
 * 본문 이미지 (04 §3.3).
 *
 * 크기를 아는 이미지(우리가 업로드한 것)는 `next/image`로 최적화한다. 크기를 모르는 이미지
 * (마이그레이션·마크다운 붙여넣기로 들어온 외부 주소)는 원본 그대로 그린다 — next/image는
 * 크기를 요구하고, 없는 값을 지어내면 레이아웃이 흔들린다.
 *
 * 즉 **최적화되지 않는 이미지가 있는 것이 정상이다.** 이관 이미지까지 억지로 끌어들이면
 * 외부 호스트 목록을 계속 늘려야 한다.
 */
export function PostImage({
  src,
  alt,
  width,
  height,
}: {
  src: string;
  alt: string;
  width: number | null;
  height: number | null;
}) {
  if (width && height) {
    return (
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        // 지면 폭(--container-measure)을 넘지 않게 두고 비율은 유지한다
        className="h-auto w-full"
        sizes="(max-width: 768px) 100vw, 720px"
      />
    );
  }

  // biome-ignore lint/performance/noImgElement: 크기를 모르는 외부 이미지 — next/image는 크기를 요구한다
  return <img src={src} alt={alt} loading="lazy" className="h-auto max-w-full" />;
}
