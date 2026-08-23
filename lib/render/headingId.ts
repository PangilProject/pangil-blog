/**
 * 제목 앵커 id (04 §3.4 TOC).
 *
 * 한글을 그대로 남긴다 — 로마자로 옮기면 목차 링크가 본문과 무관한 글자가 되고, 옛 링크를
 * 되살릴 수도 없다. 브라우저와 URL 표준 모두 유니코드 프래그먼트를 허용한다.
 *
 * 같은 제목이 두 번 나오면 뒤에 번호를 붙인다. 앵커가 겹치면 목차의 절반이 첫 항목으로 간다.
 */
export function headingId(text: string, seen: Map<string, number>): string {
  const base =
    text
      .trim()
      .toLowerCase()
      // 공백은 하이픈으로, 조판 문자(따옴표·괄호·구두점)는 버린다
      .replace(/[\s ]+/g, "-")
      .replace(/[^\p{Letter}\p{Number}가-힣-]/gu, "")
      .replace(/-{2,}/g, "-")
      .replace(/^-|-$/g, "") || "section";

  const count = (seen.get(base) ?? 0) + 1;
  seen.set(base, count);

  return count === 1 ? base : `${base}-${count}`;
}
