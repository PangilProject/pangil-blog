/**
 * textarea의 선택 범위를 표시로 감싼다 (02 §5.2 말씀 강조).
 *
 * 말씀 본문은 리치 텍스트가 아니라 **글자열**이다(저장 계약이 그렇고, 그 칸의 주인은
 * 크롤러다). 그래서 강조는 마크를 붙이는 것이 아니라 글자를 넣는 일이다.
 *
 * 이미 감싸져 있으면 **벗긴다.** 굵게를 두 번 누르면 원래대로 돌아와야 한다 — 누른 만큼
 * 별표가 쌓이면 그건 토글이 아니다.
 */
export type WrapResult = { value: string; start: number; end: number };

export function wrapSelection(
  value: string,
  start: number,
  end: number,
  marker: string,
): WrapResult {
  const selected = value.slice(start, end);

  // 고른 것이 없으면 아무 일도 하지 않는다. 빈 `****`를 남기면 지우는 일이 생긴다
  if (selected === "") return { value, start, end };

  const inside =
    selected.startsWith(marker) && selected.endsWith(marker) && selected.length > marker.length * 2;

  if (inside) {
    const bare = selected.slice(marker.length, -marker.length);
    return {
      value: value.slice(0, start) + bare + value.slice(end),
      start,
      end: start + bare.length,
    };
  }

  // 선택 **밖**이 표시일 수도 있다 — 글자만 골라 잡고 다시 누른 경우다
  const before = value.slice(Math.max(0, start - marker.length), start);
  const after = value.slice(end, end + marker.length);
  if (before === marker && after === marker) {
    return {
      value: value.slice(0, start - marker.length) + selected + value.slice(end + marker.length),
      start: start - marker.length,
      end: end - marker.length,
    };
  }

  const wrapped = `${marker}${selected}${marker}`;
  return {
    value: value.slice(0, start) + wrapped + value.slice(end),
    start,
    end: start + wrapped.length,
  };
}
