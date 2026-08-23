/**
 * 태그 이름 정리 (05 §1.4).
 *
 * DB에 닿지 않는 순수 규칙이라 리포지토리 밖에 둔다 — 이 규칙은 에디터의 입력 칸과
 * 저장 경로가 함께 쓴다.
 */
export function normalizeTagNames(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of names) {
    const name = raw.trim().replace(/\s+/g, " ");
    if (name === "") continue;
    // 대소문자만 다른 태그는 같은 태그다 — 목록에서 둘로 갈리면 탐색이 깨진다
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }

  return out;
}
