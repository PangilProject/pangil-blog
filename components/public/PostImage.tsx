import Image from "next/image";

import { isOptimizableImage } from "@/lib/render/imageHost";

/**
 * 본문 이미지 (04 §3.3).
 *
 * **우리 Storage의 이미지만** next/image로 최적화한다. 크기를 아는 것이 기준이 아니다 —
 * 티스토리에서 HTML로 붙여넣은 이미지는 width/height까지 함께 들어오고, 크기로 판단하면
 * 외부 호스트가 next/image로 넘어가 "hostname is not configured"로 지면이 터진다(실제로 그랬다).
 *
 * 즉 **최적화되지 않는 이미지가 있는 것이 정상이다.** 이관 이미지까지 억지로 끌어들이면
 * 허용 호스트 목록을 계속 늘려야 한다.
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
  if (width && height && isOptimizableImage(src)) {
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
