import { describe, expect, it } from "vitest";

import { assignCallNumbers, deriveExcerpt } from "@/scripts/migrate-tistory/loadPlan";
import type { PreparedPost } from "@/scripts/migrate-tistory/pipeline";

/**
 * 청구기호 소급은 되돌릴 수 없다 — 번호는 부여 후 불변이다(05 §5). 그래서 순서 규칙을
 * 테스트로 못박는다.
 */

function post(
  legacyId: number,
  type: PreparedPost["type"],
  date: string,
  publishable = true,
): PreparedPost {
  return {
    legacyId,
    file: `${legacyId}/x.html`,
    folder: `/backup/${legacyId}`,
    title: `글 ${legacyId}`,
    publishedAt: new Date(date),
    site: type === "TECH" ? "dev" : "faith",
    type,
    categorySlug: null,
    tags: [],
    content: {},
    publishable,
    blockers: publishable ? [] : ["본문 없음"],
    notes: [],
    images: [],
  };
}

describe("assignCallNumbers", () => {
  it("타입별로 작성일 오름차순 1..N을 준다 — 파일 순서가 아니다", () => {
    const numbers = assignCallNumbers([
      post(500, "QT", "2025-06-01"),
      post(100, "QT", "2025-01-01"),
      post(300, "QT", "2025-03-01"),
    ]);

    expect([...numbers]).toEqual([
      [100, 1],
      [300, 2],
      [500, 3],
    ]);
  });

  it("타입마다 따로 센다", () => {
    const numbers = assignCallNumbers([
      post(1, "QT", "2025-01-01"),
      post(2, "TECH", "2025-01-02"),
      post(3, "QT", "2025-01-03"),
      post(4, "PRAISE", "2025-01-04"),
    ]);

    expect(numbers.get(1)).toBe(1);
    expect(numbers.get(3)).toBe(2);
    expect(numbers.get(2)).toBe(1);
    expect(numbers.get(4)).toBe(1);
  });

  it("초안은 번호를 받지 않는다 — 발행할 때 이어받는다", () => {
    const numbers = assignCallNumbers([
      post(1, "QT", "2025-01-01"),
      post(2, "QT", "2025-01-02", false),
      post(3, "QT", "2025-01-03"),
    ]);

    expect(numbers.has(2)).toBe(false);
    // 번호에 구멍을 내지 않는다. 초안은 아직 기록물이 아니다
    expect(numbers.get(3)).toBe(2);
  });

  it("같은 시각이면 원본 글 ID 순 — 결과가 흔들리지 않아야 한다", () => {
    const numbers = assignCallNumbers([
      post(9, "QT", "2025-01-01T00:00:00Z"),
      post(4, "QT", "2025-01-01T00:00:00Z"),
    ]);

    expect(numbers.get(4)).toBe(1);
    expect(numbers.get(9)).toBe(2);
  });

  it("이미 번호가 있는 DB에 이어 붙일 수 있다", () => {
    const numbers = assignCallNumbers([post(1, "TECH", "2025-01-01")], new Map([["TECH", 45]]));

    expect(numbers.get(1)).toBe(46);
  });
});

describe("deriveExcerpt", () => {
  const tech = (text: string) => ({
    kind: "TECH" as const,
    body: {
      type: "doc" as const,
      content: [{ type: "paragraph", content: [{ type: "text", text }] }],
    },
  });

  it("TECH 본문 앞부분을 한 줄로 뽑는다", () => {
    expect(deriveExcerpt(tech("테이블은 표로 구성된 2차원 구조다."))).toBe(
      "테이블은 표로 구성된 2차원 구조다.",
    );
  });

  it("140자를 넘으면 줄인다", () => {
    const excerpt = deriveExcerpt(tech("가".repeat(300)));

    expect(excerpt).toHaveLength(140);
    expect(excerpt?.endsWith("…")).toBe(true);
  });

  it("본문이 비면 null이다", () => {
    expect(deriveExcerpt(tech("   "))).toBeNull();
  });

  it("faith 타입은 요약을 쓰지 않는다", () => {
    expect(
      deriveExcerpt({
        kind: "PRAISE",
        youtubeUrl: "https://www.youtube.com/watch?v=abc",
        sections: [],
        meditationAndPrayer: { type: "doc", content: [] },
      }),
    ).toBeNull();
  });
});
