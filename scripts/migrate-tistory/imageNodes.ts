/**
 * content 안의 이미지 노드 찾기·바꾸기 (05 §6.6).
 *
 * 이미지는 본문 맨 위에만 있는 게 아니다 — QT 답변, 찬양 묵상, 설교 본문 안에도 있다.
 * 그래서 content 전체를 훑는다(타입마다 자리가 다른 것을 여기서 신경 쓰지 않는다).
 *
 * 바꿀 때는 **새 객체를 만든다.** 원본을 제자리에서 고치면 실패한 글의 content가 반쯤
 * 바뀐 상태로 남는다.
 */

export type ImageReplacement = { src: string; width: number; height: number };

type Node = { type?: unknown; attrs?: Record<string, unknown> };

function isImage(value: unknown): value is Node {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Node).type === "image" &&
    typeof (value as Node).attrs?.src === "string"
  );
}

export function collectImageSrcs(content: unknown): string[] {
  const found: string[] = [];

  const walk = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const child of value) walk(child);
      return;
    }

    if (typeof value !== "object" || value === null) return;

    if (isImage(value)) found.push(value.attrs?.src as string);

    for (const child of Object.values(value)) walk(child);
  };

  walk(content);
  return found;
}

/** 옮긴 주소로 바꾸고 폭·높이를 채운다. 지도에 없는 이미지는 그대로 둔다 */
export function rewriteImageSrcs<T>(content: T, replacements: Map<string, ImageReplacement>): T {
  const map = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(map);
    if (typeof value !== "object" || value === null) return value;

    if (isImage(value)) {
      const replacement = replacements.get(value.attrs?.src as string);
      if (!replacement) return value;

      return {
        ...value,
        attrs: {
          ...value.attrs,
          src: replacement.src,
          width: replacement.width,
          height: replacement.height,
        },
      };
    }

    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, map(child)]));
  };

  return map(content) as T;
}
